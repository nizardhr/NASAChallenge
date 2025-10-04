/**
 * ============================================================================
 * NASA PROXY SERVER - BINARY NETCDF SUPPORT (PATCHED VERSION)
 * ============================================================================
 * 
 *  ✅ Keeps all existing features
 *  ✅ Fixes InvalidCharacterError (base64 of HTML)
 *  ✅ Adds content-type guard and verbose NASA logging
 *  ✅ Validates credentials on startup
 * 
 * ============================================================================
 */

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { CookieJar } from 'tough-cookie';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NASA_USERNAME = process.env.NASA_USERNAME;
const NASA_PASSWORD = process.env.NASA_PASSWORD;

// Configuration
const DOWNLOAD_TIMEOUT = 60000; // 60 seconds
const MAX_RETRIES = 2;

// ============================================================================
// VALIDATE CREDENTIALS ON STARTUP
// ============================================================================

if (!NASA_USERNAME || !NASA_PASSWORD) {
  console.error('\n❌ ============================================');
  console.error('   CONFIGURATION ERROR');
  console.error(' ============================================');
  console.error(' NASA Earthdata credentials not found!');
  console.error(' Add to your .env file:');
  console.error('   NASA_USERNAME=your_earthdata_username');
  console.error('   NASA_PASSWORD=your_earthdata_password');
  console.error(' Get credentials at: https://urs.earthdata.nasa.gov');
  console.error('❌ ============================================\n');
  process.exit(1);
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
  req.setTimeout(DOWNLOAD_TIMEOUT + 10000);
  res.setTimeout(DOWNLOAD_TIMEOUT + 10000);
  next();
});

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    credentialsConfigured: !!(NASA_USERNAME && NASA_PASSWORD),
    username: NASA_USERNAME ? `${NASA_USERNAME.substring(0, 3)}***` : 'not configured',
    uptime: process.uptime(),
    timeout: `${DOWNLOAD_TIMEOUT / 1000}s`,
    format: 'Binary NetCDF (DODS) + ASCII supported'
  });
});

// ============================================================================
// NASA AUTH + BINARY DOWNLOAD
// ============================================================================

async function downloadWithAuth(url) {
  console.log('🔐 Starting NASA authentication flow...');
  
  const isBinaryFormat = url.includes('.dods?') || url.includes('.nc4');
  console.log(`   Format detected: ${isBinaryFormat ? 'Binary NetCDF (DODS)' : 'ASCII text'}`);
  
  const cookieJar = new CookieJar();

  const extractCookies = (response, currentUrl) => {
    const setCookieHeaders = response.headers.raw()['set-cookie'];
    if (setCookieHeaders) {
      setCookieHeaders.forEach(cookie => {
        try {
          cookieJar.setCookieSync(cookie, currentUrl);
          console.log('   📝 Stored cookie:', cookie.split(';')[0]);
        } catch {
          console.log('   ⚠️ Cookie parsing issue (non-critical)');
        }
      });
    }
  };

  const getCookieString = (targetUrl) => {
    try {
      const cookies = cookieJar.getCookiesSync(targetUrl);
      return cookies.map(c => c.cookieString()).join('; ');
    } catch {
      return '';
    }
  };

  try {
    console.log('   Step 1: Request OPeNDAP URL...');
    let response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'GLDAS-Binary-Downloader/2.0' },
      redirect: 'manual',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT)
    });

    console.log('   Initial response:', response.status);
    extractCookies(response, url);

    // Redirect to login if needed
    if ([301, 302, 307].includes(response.status)) {
      console.log('   Step 2: Redirecting to authentication...');
      const redirectUrl = response.headers.get('location');
      console.log('   Redirect URL:', redirectUrl);

      // Auth request
      response = await fetch(redirectUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${NASA_USERNAME}:${NASA_PASSWORD}`).toString('base64')}`,
          'User-Agent': 'GLDAS-Binary-Downloader/2.0',
          'Cookie': getCookieString(redirectUrl)
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT)
      });

      extractCookies(response, redirectUrl);

      // Follow redirects back to data
      let maxRedirects = 5;
      while ([301, 302, 307].includes(response.status) && maxRedirects-- > 0) {
        const nextUrl = response.headers.get('location');
        console.log('   ↪️ Redirecting to:', nextUrl);
        response = await fetch(nextUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'GLDAS-Binary-Downloader/2.0',
            'Cookie': getCookieString(nextUrl)
          },
          redirect: 'manual',
          signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT)
        });
        extractCookies(response, nextUrl);
      }
    }

    // === FINAL RESPONSE ===
    if (response.status === 200) {
      console.log('   ✅ Authentication successful, downloading data...');
      const contentType = response.headers.get('content-type') || '';
      console.log('   📑 Content-Type:', contentType);

      // Detect HTML error
      if (contentType.includes('text') || contentType.includes('html')) {
        const text = await response.text();
        console.error('   ❌ NASA returned HTML instead of binary.');
        console.error('   First 300 chars:\n', text.slice(0, 300));
        throw new Error('NASA returned HTML instead of binary data — authentication or URL issue.');
      }

      if (isBinaryFormat) {
        console.log('   📦 Downloading as binary ArrayBuffer...');
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');
        console.log(`   ✅ Binary data downloaded: ${(buffer.length / 1024).toFixed(2)} KB`);
        return { success: true, data: base64Data, dataSize: buffer.length, format: 'binary' };
      } else {
        console.log('   📄 Downloading as ASCII text...');
        const textData = await response.text();
        console.log(`   ✅ Text data downloaded: ${(textData.length / 1024).toFixed(2)} KB`);
        return { success: true, data: textData, dataSize: textData.length, format: 'ascii' };
      }
    }

    throw new Error(`Unexpected response: ${response.status}`);

  } catch (error) {
    console.error('   ❌ Auth flow error:', error.message);
    throw error;
  }
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

async function downloadWithRetry(url, maxRetries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🚀 Download attempt ${attempt}/${maxRetries}...`);
      const startTime = Date.now();
      const result = await downloadWithAuth(url);
      const responseTime = Date.now() - startTime;
      console.log('✅ Download successful!');
      console.log('   Format:', result.format);
      console.log('   Data size:', (result.dataSize / 1024).toFixed(2), 'KB');
      console.log('   Total time:', responseTime, 'ms\n');
      return { ...result, responseTime };
    } catch (error) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      if ((error.name === 'AbortError' || error.name === 'TimeoutError') && attempt < maxRetries) {
        console.log('⏳ Retrying in 2 seconds...');
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// ============================================================================
// API ENDPOINT
// ============================================================================

app.post('/api/download-gldas', async (req, res) => {
  console.log('\n📥 ========================================');
  console.log(' GLDAS FILE DOWNLOAD REQUEST');
  console.log('========================================');

  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, error: 'URL is required' });
  if (!url.includes('gesdisc.eosdis.nasa.gov'))
    return res.status(400).json({ success: false, error: 'Only NASA GES DISC URLs are allowed' });

  try {
    const result = await downloadWithRetry(url);
    res.status(200).json({
      success: true,
      data: result.data,
      dataSize: result.dataSize,
      format: result.format,
      metadata: {
        responseTime: result.responseTime,
        dataSize: result.dataSize,
        format: result.format,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Download Error:', error.name, '-', error.message);
    if (error.name === 'AbortError' || error.name === 'TimeoutError')
      return res.status(504).json({ success: false, error: 'Timeout', message: 'NASA server slow' });
    if (error.message.includes('401'))
      return res.status(401).json({ success: false, error: 'Auth failed' });
    if (error.message.includes('404'))
      return res.status(404).json({ success: false, error: 'File not found' });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 404 + ERROR HANDLERS
// ============================================================================

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', message: `${req.method} ${req.path} not found` });
});

app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// ============================================================================
// START SERVER (with credential test)
// ============================================================================

(async () => {
  try {
    console.log('🔍 Validating NASA credentials...');
    const testUrl = 'https://urs.earthdata.nasa.gov/profile';
    const auth = `Basic ${Buffer.from(`${NASA_USERNAME}:${NASA_PASSWORD}`).toString('base64')}`;
    const resp = await fetch(testUrl, { headers: { Authorization: auth } });
    console.log(resp.status === 200 ? '✅ NASA credentials valid\n' : '⚠️ NASA login check failed\n');
  } catch (e) {
    console.log('⚠️ Could not verify credentials automatically\n');
  }

  app.listen(PORT, () => {
    console.log('\n🚀 ============================================');
    console.log('   NASA GLDAS PROXY SERVER - BINARY NETCDF');
    console.log(' ============================================');
    console.log(` ✅ Server: http://localhost:${PORT}`);
    console.log(` 📥 Endpoint: POST /api/download-gldas`);
    console.log(` ❤️  Health: GET /api/health`);
    console.log(` 👤 Username: ${NASA_USERNAME.substring(0, 3)}***`);
    console.log(` ⏱️ Timeout: ${DOWNLOAD_TIMEOUT / 1000}s`);
    console.log(` 📦 Formats: Binary NetCDF (DODS) + ASCII`);
    console.log('🚀 ============================================\n');
  });
})();

/**
 * ============================================================================
 * NASA PROXY SERVER - EARTHDATA AUTHENTICATION WITH COOKIE JAR
 * ============================================================================
 * 
 * AUTHENTICATION METHOD: HTTP Basic Auth with Cookie Session Management
 * - Uses NASA Earthdata Login credentials (username/password)
 * - Properly handles cookie-based session across redirects
 * - Required for OPeNDAP data access
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
const DOWNLOAD_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;

// ============================================================================
// VALIDATE CREDENTIALS ON STARTUP
// ============================================================================

if (!NASA_USERNAME || !NASA_PASSWORD) {
  console.error('\n❌ ============================================');
  console.error('   CONFIGURATION ERROR');
  console.error(' ============================================');
  console.error('');
  console.error(' NASA Earthdata credentials not found!');
  console.error('');
  console.error(' Please add to your .env file:');
  console.error('');
  console.error('   NASA_USERNAME=your_earthdata_username');
  console.error('   NASA_PASSWORD=your_earthdata_password');
  console.error('');
  console.error(' Get credentials at:');
  console.error(' 👉 https://urs.earthdata.nasa.gov');
  console.error('');
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
    timeout: `${DOWNLOAD_TIMEOUT / 1000}s`
  });
});

// ============================================================================
// HELPER: NASA AUTHENTICATION WITH COOKIE JAR
// ============================================================================

async function downloadWithAuth(url) {
  console.log('🔐 Starting NASA authentication flow...');
  
  // Create cookie jar to store session cookies
  const cookieJar = new CookieJar();
  
  // Helper function to extract and store cookies
  const extractCookies = (response, currentUrl) => {
    const setCookieHeaders = response.headers.raw()['set-cookie'];
    if (setCookieHeaders) {
      setCookieHeaders.forEach(cookie => {
        try {
          cookieJar.setCookieSync(cookie, currentUrl);
          console.log('   📝 Stored cookie:', cookie.split(';')[0]);
        } catch (e) {
          console.log('   ⚠️  Cookie parsing issue (non-critical)');
        }
      });
    }
  };
  
  // Helper function to get cookies for a URL
  const getCookieString = (targetUrl) => {
    try {
      const cookies = cookieJar.getCookiesSync(targetUrl);
      return cookies.map(c => c.cookieString()).join('; ');
    } catch (e) {
      return '';
    }
  };
  
  try {
    // STEP 1: Initial request to OPeNDAP URL
    console.log('   Step 1: Request OPeNDAP URL...');
    let response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'GLDAS-Downloader/1.0',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT)
    });
    
    console.log('   Initial response:', response.status);
    extractCookies(response, url);
    
    // STEP 2: Follow redirect to URS login
    if (response.status === 302 || response.status === 301) {
      const loginUrl = response.headers.get('location');
      console.log('   Step 2: Redirect to URS login...');
      console.log('   Login URL:', loginUrl?.substring(0, 60) + '...');
      
      // Create Basic Auth header
      const credentials = Buffer.from(`${NASA_USERNAME}:${NASA_PASSWORD}`).toString('base64');
      const cookieHeader = getCookieString(loginUrl);
      
      response = await fetch(loginUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'User-Agent': 'GLDAS-Downloader/1.0',
          ...(cookieHeader && { 'Cookie': cookieHeader })
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT)
      });
      
      console.log('   URS auth response:', response.status);
      extractCookies(response, loginUrl);
      
      // STEP 3: Follow redirect chain back to data
      let redirectCount = 0;
      while ((response.status === 302 || response.status === 301) && redirectCount < 5) {
        redirectCount++;
        const nextUrl = response.headers.get('location');
        console.log(`   Step ${3 + redirectCount}: Following redirect ${redirectCount}...`);
        console.log('   To:', nextUrl?.substring(0, 60) + '...');
        
        const cookieHeader = getCookieString(nextUrl);
        
        response = await fetch(nextUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'GLDAS-Downloader/1.0',
            ...(cookieHeader && { 'Cookie': cookieHeader })
          },
          redirect: 'manual',
          signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT)
        });
        
        console.log('   Response:', response.status);
        extractCookies(response, nextUrl);
      }
      
      // STEP 4: Final request with all accumulated cookies
      if (response.status === 200) {
        console.log('   ✅ Authentication successful, downloading data...');
        const textData = await response.text();
        return {
          success: true,
          data: textData,
          dataSize: textData.length
        };
      } else {
        throw new Error(`Final response was ${response.status} instead of 200`);
      }
    } else if (response.status === 200) {
      // Direct access (no auth needed)
      console.log('   ✅ Direct access granted');
      const textData = await response.text();
      return {
        success: true,
        data: textData,
        dataSize: textData.length
      };
    } else {
      throw new Error(`Unexpected initial response: ${response.status}`);
    }
    
  } catch (error) {
    console.error('   ❌ Auth flow error:', error.message);
    throw error;
  }
}

// ============================================================================
// HELPER: DOWNLOAD WITH RETRY
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
      console.log('   Data size:', result.dataSize, 'characters');
      console.log('   Total time:', responseTime, 'ms\n');

      return {
        ...result,
        responseTime: responseTime
      };

    } catch (error) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      if ((error.name === 'AbortError' || error.name === 'TimeoutError') && attempt < maxRetries) {
        console.log(`⏳ Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

// ============================================================================
// GLDAS FILE DOWNLOAD ENDPOINT
// ============================================================================

app.post('/api/download-gldas', async (req, res) => {
  console.log('\n📥 ========================================');
  console.log(' GLDAS FILE DOWNLOAD REQUEST');
  console.log('========================================');

  const { url } = req.body;

  console.log('📋 Request Details:');
  console.log('   URL:', url ? url.substring(0, 100) + '...' : 'missing');
  console.log('   Using credentials: ', NASA_USERNAME ? `${NASA_USERNAME.substring(0, 3)}***` : 'not configured');
  console.log('   Timeout:', DOWNLOAD_TIMEOUT / 1000, 'seconds');

  if (!url) {
    console.error('❌ Missing URL');
    return res.status(400).json({ 
      success: false,
      error: 'URL is required'
    });
  }

  if (!url.includes('gesdisc.eosdis.nasa.gov')) {
    console.error('❌ Invalid URL domain');
    return res.status(400).json({ 
      success: false,
      error: 'Only NASA GES DISC URLs are allowed'
    });
  }

  try {
    const result = await downloadWithRetry(url);

    return res.status(200).json({
      success: true,
      data: result.data,
      dataSize: result.dataSize,
      metadata: {
        responseTime: result.responseTime,
        dataSize: result.dataSize,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Download Error:', error.name, '-', error.message, '\n');

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return res.status(504).json({ 
        success: false,
        error: 'Request timeout',
        message: `Download took longer than ${DOWNLOAD_TIMEOUT / 1000} seconds. NASA servers may be slow. Try selecting a smaller date range.`,
        suggestion: 'Reduce the date range to download fewer files at once.'
      });
    }

    if (error.message.includes('401')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'NASA Earthdata credentials are invalid. Please check NASA_USERNAME and NASA_PASSWORD in .env file.',
        suggestion: 'Verify your credentials at https://urs.earthdata.nasa.gov'
      });
    }

    if (error.message.includes('404')) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
        message: 'The requested GLDAS file does not exist'
      });
    }

    if (error.message.includes('503') || error.message.includes('504')) {
      return res.status(503).json({
        success: false,
        error: 'Service unavailable',
        message: 'NASA servers are experiencing high load. Try again in a few minutes.'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Download failed',
      message: error.message,
      suggestion: 'If this persists, try a smaller date range or try again later.'
    });
  }
});

// ============================================================================
// ERROR HANDLERS
// ============================================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    error: 'Server error',
    message: err.message
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log('\n');
  console.log('🚀 ============================================');
  console.log('   NASA GLDAS PROXY SERVER');
  console.log(' ============================================');
  console.log('');
  console.log(` ✅ Server: http://localhost:${PORT}`);
  console.log(` 📥 Endpoint: POST /api/download-gldas`);
  console.log(` ❤️  Health: GET /api/health`);
  console.log(` 🔑 Auth: Basic (Earthdata Login + Cookies)`);
  console.log(` 👤 Username: ${NASA_USERNAME.substring(0, 3)}***`);
  console.log(` ⏱️  Timeout: ${DOWNLOAD_TIMEOUT / 1000} seconds`);
  console.log(` 🔄 Max Retries: ${MAX_RETRIES}`);
  console.log('');
  console.log(' 📋 AUTHENTICATION:');
  console.log('   Using NASA Earthdata Login with cookie jar');
  console.log('   Properly handles redirect chain and sessions');
  console.log('');
  console.log(' 💡 Tip: Select smaller date ranges if timeouts occur');
  console.log('');
  console.log(' Press Ctrl+C to stop');
  console.log('');
  console.log('🚀 ============================================\n');
});
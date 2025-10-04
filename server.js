/**
 * ============================================================================
 * NASA PROXY SERVER - BINARY NETCDF SUPPORT
 * ============================================================================
 * 
 * CRITICAL FIX: Handles BINARY NetCDF data (.dods format)
 * - Downloads binary data as ArrayBuffer
 * - Converts to base64 for JSON transmission
 * - Supports both ASCII and binary formats
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
const DOWNLOAD_TIMEOUT = 60000; // 60 seconds (binary files are larger)
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
    timeout: `${DOWNLOAD_TIMEOUT / 1000}s`,
    format: 'Binary NetCDF (DODS) + ASCII supported'
  });
});

// ============================================================================
// HELPER: NASA AUTHENTICATION WITH COOKIE JAR - BINARY SUPPORT
// ============================================================================

async function downloadWithAuth(url) {
  console.log('🔐 Starting NASA authentication flow...');
  
  // Detect if binary NetCDF format
  const isBinaryFormat = url.includes('.dods?') || url.includes('.nc4.nc4');
  console.log(`   Format detected: ${isBinaryFormat ? 'Binary NetCDF (DODS)' : 'ASCII text'}`);
  
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
        'User-Agent': 'GLDAS-Binary-Downloader/2.0',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT)
    });
    
    console.log('   Initial response:', response.status);
    extractCookies(response, url);
    
    // Handle redirects manually
    if (response.status === 302 || response.status === 301 || response.status === 307) {
      console.log('   Step 2: Following redirect to authentication...');
      const redirectUrl = response.headers.get('location');
      console.log('   Redirect URL:', redirectUrl?.substring(0, 80) + '...');
      
      // STEP 2: Follow redirect to auth page WITH credentials
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
      
      console.log('   Auth response:', response.status);
      extractCookies(response, redirectUrl);
      
      // STEP 3: Follow redirects back to data
      let maxRedirects = 5;
      while ((response.status === 302 || response.status === 301 || response.status === 307) && maxRedirects > 0) {
        maxRedirects--;
        const nextUrl = response.headers.get('location');
        console.log('   Step 3: Following redirect back to data...');
        console.log('   Next URL:', nextUrl?.substring(0, 80) + '...');
        
        response = await fetch(nextUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'GLDAS-Binary-Downloader/2.0',
            'Cookie': getCookieString(nextUrl)
          },
          redirect: 'manual',
          signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT)
        });
        
        console.log('   Response:', response.status);
        extractCookies(response, nextUrl);
      }
      
      // STEP 4: Final data download
      if (response.status === 200) {
        console.log('   ✅ Authentication successful, downloading data...');
        
        // CRITICAL: Handle binary vs text data
        if (isBinaryFormat) {
          console.log('   📦 Downloading as binary ArrayBuffer...');
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64Data = buffer.toString('base64');
          
          console.log(`   ✅ Binary data downloaded: ${(buffer.length / 1024).toFixed(2)} KB`);
          console.log(`   ✅ Base64 encoded: ${(base64Data.length / 1024).toFixed(2)} KB`);
          
          return {
            success: true,
            data: base64Data,
            dataSize: buffer.length,
            format: 'binary'
          };
        } else {
          console.log('   📄 Downloading as ASCII text...');
          const textData = await response.text();
          
          console.log(`   ✅ Text data downloaded: ${(textData.length / 1024).toFixed(2)} KB`);
          
          return {
            success: true,
            data: textData,
            dataSize: textData.length,
            format: 'ascii'
          };
        }
      } else {
        throw new Error(`Final response was ${response.status} instead of 200`);
      }
    } else if (response.status === 200) {
      // Direct access (no auth needed)
      console.log('   ✅ Direct access granted');
      
      // CRITICAL: Handle binary vs text data
      if (isBinaryFormat) {
        console.log('   📦 Downloading as binary ArrayBuffer...');
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');
        
        console.log(`   ✅ Binary data downloaded: ${(buffer.length / 1024).toFixed(2)} KB`);
        
        return {
          success: true,
          data: base64Data,
          dataSize: buffer.length,
          format: 'binary'
        };
      } else {
        console.log('   📄 Downloading as ASCII text...');
        const textData = await response.text();
        
        console.log(`   ✅ Text data downloaded: ${(textData.length / 1024).toFixed(2)} KB`);
        
        return {
          success: true,
          data: textData,
          dataSize: textData.length,
          format: 'ascii'
        };
      }
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
      console.log('   Format:', result.format);
      console.log('   Data size:', (result.dataSize / 1024).toFixed(2), 'KB');
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
// GLDAS FILE DOWNLOAD ENDPOINT - BINARY NETCDF SUPPORT
// ============================================================================

app.post('/api/download-gldas', async (req, res) => {
  console.log('\n📥 ========================================');
  console.log(' GLDAS FILE DOWNLOAD REQUEST');
  console.log('========================================');

  const { url } = req.body;

  console.log('📋 Request Details:');
  console.log('   URL:', url ? url.substring(0, 100) + '...' : 'missing');
  console.log('   Format:', url?.includes('.dods?') ? 'Binary NetCDF (DODS)' : 'ASCII');
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
      format: result.format,
      metadata: {
        responseTime: result.responseTime,
        dataSize: result.dataSize,
        format: result.format,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Download Error:', error.name, '-', error.message, '\n');

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return res.status(504).json({ 
        success: false,
        error: 'Request timeout',
        message: `Download took longer than ${DOWNLOAD_TIMEOUT / 1000} seconds. NASA servers may be slow.`,
        suggestion: 'Try a smaller date range or try again later.'
      });
    }

    if (error.message.includes('401')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'NASA Earthdata credentials are invalid.',
        suggestion: 'Verify credentials at https://urs.earthdata.nasa.gov'
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
      suggestion: 'If this persists, try again later.'
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
  console.log('   NASA GLDAS PROXY SERVER - BINARY NETCDF');
  console.log(' ============================================');
  console.log('');
  console.log(` ✅ Server: http://localhost:${PORT}`);
  console.log(` 📥 Endpoint: POST /api/download-gldas`);
  console.log(` ❤️  Health: GET /api/health`);
  console.log(` 🔑 Auth: Basic (Earthdata Login + Cookies)`);
  console.log(` 👤 Username: ${NASA_USERNAME.substring(0, 3)}***`);
  console.log(` ⏱️  Timeout: ${DOWNLOAD_TIMEOUT / 1000} seconds`);
  console.log(` 📦 Formats: Binary NetCDF (DODS) + ASCII`);
  console.log('');
  console.log(' 📋 BINARY NETCDF SUPPORT:');
  console.log('   ✅ Handles .dods format (Binary NetCDF-4)');
  console.log('   ✅ Converts to base64 for JSON transmission');
  console.log('   ✅ ALL 36 GLDAS variables supported');
  console.log('');
  console.log(' Press Ctrl+C to stop');
  console.log('');
  console.log('🚀 ============================================\n');
});
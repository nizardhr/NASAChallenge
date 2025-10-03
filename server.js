/**
 * ============================================================================
 * NASA PROXY SERVER - TOKEN AUTHENTICATION (ENHANCED TIMEOUTS)
 * ============================================================================
 * 
 * CHANGES:
 * - Increased timeout from 60s to 180s (3 minutes)
 * - Added retry logic for timeout failures
 * - Better error messages with retry suggestions
 * - Progress logging for long downloads
 * 
 * ============================================================================
 */

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NASA_TOKEN = process.env.NASA_TOKEN;

// Configuration
const DOWNLOAD_TIMEOUT = 30000; // 30 seconds (reduced from 180s due to spatial optimization)
const MAX_RETRIES = 2; // Number of retry attempts for failed downloads

// Check if token is configured
if (!NASA_TOKEN) {
  console.error('❌ ERROR: NASA_TOKEN not found in environment variables!');
  console.error('   Please add NASA_TOKEN to your .env file');
  console.error('   Get your token at: https://urs.earthdata.nasa.gov/profile\n');
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

// Increase request timeout for Express
app.use((req, res, next) => {
  req.setTimeout(DOWNLOAD_TIMEOUT + 10000); // Slightly more than fetch timeout
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
    tokenConfigured: !!NASA_TOKEN,
    uptime: process.uptime(),
    timeout: `${DOWNLOAD_TIMEOUT / 1000}s`
  });
});

// ============================================================================
// HELPER: DOWNLOAD WITH RETRY
// ============================================================================

async function downloadWithRetry(url, maxRetries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🚀 Download attempt ${attempt}/${maxRetries}...`);
      const startTime = Date.now();

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${NASA_TOKEN}`,
          'User-Agent': 'GLDAS-Downloader/1.0'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT)
      });

      const responseTime = Date.now() - startTime;

      console.log('📊 Response:');
      console.log('   Status:', response.status);
      console.log('   Time:', responseTime, 'ms');
      console.log('   Content-Type:', response.headers.get('content-type'));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get data as text (for ASCII format)
      const textData = await response.text();

      console.log('✅ Download successful!');
      console.log('   Data size:', textData.length, 'characters');
      console.log('   Total time:', responseTime, 'ms\n');

      return {
        success: true,
        data: textData,
        dataSize: textData.length,
        responseTime: responseTime
      };

    } catch (error) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      // If it's a timeout and we have retries left, try again
      if ((error.name === 'AbortError' || error.name === 'TimeoutError') && attempt < maxRetries) {
        console.log(`⏳ Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      // If not timeout or no retries left, throw
      throw error;
    }
  }
  
  throw lastError;
}

// ============================================================================
// GLDAS FILE DOWNLOAD ENDPOINT (TOKEN AUTH)
// ============================================================================

app.post('/api/download-gldas', async (req, res) => {
  console.log('\n📥 ========================================');
  console.log(' GLDAS FILE DOWNLOAD REQUEST');
  console.log('========================================');

  const { url } = req.body;

  console.log('📋 Request Details:');
  console.log('   URL:', url ? url.substring(0, 100) + '...' : 'missing');
  console.log('   Using server token: ***' + NASA_TOKEN.slice(-4));
  console.log('   Timeout:', DOWNLOAD_TIMEOUT / 1000, 'seconds');

  // Validate URL
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
    // Download with retry logic
    const result = await downloadWithRetry(url);

    return res.status(200).json({
      success: true,
      data: result.data,
      dataSize: result.dataSize,
      metadata: {
        responseTime: result.responseTime,
        dataSize: result.dataSize,
        timestamp: new Date().toISOString(),
        attempts: 1 // Could track this if needed
      }
    });

  } catch (error) {
    console.error('❌ Download Error:', error.name, '-', error.message, '\n');

    // Handle specific error types
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
        message: 'The NASA token is invalid or expired. Please update NASA_TOKEN in .env'
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
  console.log(` 🔑 Token: Configured (***${NASA_TOKEN.slice(-4)})`);
  console.log(` ⏱️  Timeout: ${DOWNLOAD_TIMEOUT / 1000} seconds`);
  console.log(` 🔄 Max Retries: ${MAX_RETRIES}`);
  console.log('');
  console.log(' Users only need to provide location & dates');
  console.log(' Server handles all authentication automatically');
  console.log('');
  console.log(' 💡 Tip: Select smaller date ranges if timeouts occur');
  console.log('');
  console.log(' Press Ctrl+C to stop');
  console.log('');
  console.log('🚀 ============================================\n');
});
/**
 * ============================================================================
 * NASA PROXY SERVER - TOKEN AUTHENTICATION
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
    uptime: process.uptime()
  });
});

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
    console.log('🚀 Downloading with token authentication...');
    const startTime = Date.now();

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${NASA_TOKEN}`,
        'User-Agent': 'GLDAS-Downloader/1.0'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(60000) // 60 seconds
    });

    const responseTime = Date.now() - startTime;

    console.log('📊 Response:');
    console.log('   Status:', response.status);
    console.log('   Time:', responseTime, 'ms');
    console.log('   Content-Type:', response.headers.get('content-type'));

    if (!response.ok) {
      if (response.status === 401) {
        console.error('❌ Token authentication failed');
        return res.status(401).json({
          success: false,
          error: 'Token authentication failed',
          message: 'The NASA token is invalid or expired. Please update NASA_TOKEN in .env'
        });
      }

      if (response.status === 404) {
        console.error('❌ File not found');
        return res.status(404).json({
          success: false,
          error: 'File not found',
          message: 'The requested GLDAS file does not exist'
        });
      }

      console.error('❌ Request failed:', response.status);
      return res.status(response.status).json({
        success: false,
        error: `Request failed: ${response.status}`,
        message: response.statusText
      });
    }

    // Get data as text (for ASCII format)
    const textData = await response.text();

    console.log('✅ Download successful!');
    console.log('   Data size:', textData.length, 'characters\n');

    return res.status(200).json({
      success: true,
      data: textData,
      dataSize: textData.length,
      metadata: {
        responseTime: responseTime,
        dataSize: textData.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Download Error:', error.name, '-', error.message, '\n');

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return res.status(504).json({ 
        success: false,
        error: 'Request timeout',
        message: 'Download took too long. Try again.'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Download failed',
      message: error.message
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
  console.log('');
  console.log(' Users only need to provide location & dates');
  console.log(' Server handles all authentication automatically');
  console.log('');
  console.log(' Press Ctrl+C to stop');
  console.log('');
  console.log('🚀 ============================================\n');
});
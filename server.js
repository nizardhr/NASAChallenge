/**
 * ============================================================================
 * NASA PROXY SERVER - LOCAL DEVELOPMENT
 * ============================================================================
 * 
 * PURPOSE:
 * Backend proxy server that handles authentication and downloads from NASA
 * GES DISC servers, bypassing CORS restrictions.
 * 
 * ENDPOINTS:
 * - POST /api/nasa-proxy - General NASA API proxy
 * - POST /api/download-gldas - GLDAS file download endpoint
 * - GET /api/health - Health check endpoint
 * 
 * ============================================================================
 */

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json({ limit: '50mb' }));

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    endpoints: {
      'POST /api/nasa-proxy': 'General NASA API proxy',
      'POST /api/download-gldas': 'GLDAS file downloads',
      'GET /api/health': 'Health check'
    }
  });
});
// Test NASA Authentication endpoint
app.post('/api/test-nasa-auth', async (req, res) => {
  console.log('\n🧪 ========================================');
  console.log(' TESTING NASA AUTHENTICATION');
  console.log('========================================');

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: 'Missing credentials',
      message: 'Username and password are required'
    });
  }

  try {
    // Test with the GES DISC homepage
    const testUrl = 'https://hydro1.gesdisc.eosdis.nasa.gov/data/GLDAS/';
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');

    console.log('🔍 Testing authentication with GES DISC...');

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'Auth-Test/1.0'
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(10000)
    });

    console.log('📊 Response Status:', response.status);

    if (response.status === 200) {
      return res.json({
        success: true,
        message: 'Authentication successful! Your credentials work.',
        status: 200
      });
    } else if (response.status === 401) {
      return res.json({
        success: false,
        message: 'Invalid username or password. Please check your NASA Earthdata credentials.',
        status: 401,
        hint: 'Try logging in at https://urs.earthdata.nasa.gov to verify your credentials'
      });
    } else if (response.status === 403) {
      return res.json({
        success: false,
        message: 'Access forbidden. You need to approve the GES DISC DATA ARCHIVE application.',
        status: 403,
        hint: 'Visit https://urs.earthdata.nasa.gov/profile and approve "NASA GESDISC DATA ARCHIVE"'
      });
    } else if (response.status === 302 || response.status === 301) {
      return res.json({
        success: false,
        message: 'Authentication redirect detected. This suggests credentials are not being accepted.',
        status: response.status,
        hint: 'You may need to approve the GES DISC application at https://urs.earthdata.nasa.gov/profile'
      });
    } else {
      return res.json({
        success: false,
        message: `Unexpected response: ${response.status} ${response.statusText}`,
        status: response.status
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// GENERAL NASA PROXY ENDPOINT
// ============================================================================

app.post('/api/nasa-proxy', async (req, res) => {
  console.log('\n📡 ========================================');
  console.log(' NASA PROXY REQUEST');
  console.log('========================================');

  const { url, username, password } = req.body;

  console.log('📋 Request Details:');
  console.log('   URL:', url ? url.substring(0, 100) + '...' : 'missing');
  console.log('   Username:', username ? '***' + username.slice(-3) : 'missing');
  console.log('   Password:', password ? '***' : 'missing');

  // Validate inputs
  if (!url || !username || !password) {
    console.error('❌ Missing required fields');
    return res.status(400).json({ 
      error: 'Missing required fields',
      message: 'URL, username, and password are required'
    });
  }

  // Validate URL is NASA domain
  if (!url.includes('gesdisc.eosdis.nasa.gov')) {
    console.error('❌ Invalid URL domain:', url);
    return res.status(400).json({ 
      error: 'Invalid URL',
      message: 'Only NASA GES DISC URLs are allowed'
    });
  }

  try {
    console.log('🚀 Forwarding request to NASA...');

    // Create Basic Auth header
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');

    const startTime = Date.now();

    // Make request to NASA
    const nasaResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'NASA-Proxy/1.0',
        'Accept': 'text/plain, application/json, */*'
      },
      signal: AbortSignal.timeout(45000) // 45 seconds
    });

    const responseTime = Date.now() - startTime;

    console.log('📊 NASA Response:');
    console.log('   Status:', nasaResponse.status);
    console.log('   Status Text:', nasaResponse.statusText);
    console.log('   Time:', responseTime, 'ms');
    console.log('   Content-Type:', nasaResponse.headers.get('content-type'));

    // Get response data as text
    const data = await nasaResponse.text();

    console.log('   Data Length:', data.length, 'characters');

    // Handle different status codes
    if (nasaResponse.status === 401) {
      console.error('❌ Authentication failed (401)');
      return res.status(401).json({
        status: 401,
        success: false,
        error: 'Authentication failed',
        message: 'Invalid NASA Earthdata credentials'
      });
    }

    if (nasaResponse.status === 403) {
      console.error('❌ Access forbidden (403)');
      return res.status(403).json({
        status: 403,
        success: false,
        error: 'Access forbidden',
        message: 'GES DISC application authorization required'
      });
    }

    if (nasaResponse.status === 404) {
      console.error('❌ Not found (404)');
      return res.status(404).json({
        status: 404,
        success: false,
        error: 'Not found',
        message: 'Requested resource not found'
      });
    }

    if (!nasaResponse.ok) {
      console.error('❌ NASA returned error:', nasaResponse.status);
      return res.status(nasaResponse.status).json({
        status: nasaResponse.status,
        success: false,
        error: `NASA API Error (${nasaResponse.status})`,
        message: nasaResponse.statusText
      });
    }

    console.log('✅ Request successful\n');

    // Return successful response
    return res.status(200).json({
      status: 200,
      success: true,
      data: data,
      metadata: {
        responseTime: responseTime,
        dataSize: data.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Proxy Error:', error);
    console.error('   Error Name:', error.name);
    console.error('   Error Message:', error.message, '\n');

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return res.status(504).json({ 
        error: 'Request timeout',
        message: 'The request to NASA took too long. Please try again.'
      });
    }

    return res.status(500).json({
      error: 'Internal proxy error',
      message: error.message
    });
  }
});

// ============================================================================
// GLDAS FILE DOWNLOAD ENDPOINT
// ============================================================================

app.post('/api/download-gldas', async (req, res) => {
  console.log('\n📥 ========================================');
  console.log(' GLDAS FILE DOWNLOAD REQUEST');
  console.log('========================================');

  const { url, username, password } = req.body;

  console.log('📋 Request Details:');
  console.log('   URL:', url ? url.substring(0, 100) + '...' : 'missing');
  console.log('   Username:', username ? '***' + username.slice(-3) : 'missing');
  console.log('   Password:', password ? '***' : 'missing');

  // Validate inputs
  if (!url || !username || !password) {
    console.error('❌ Missing required fields');
    return res.status(400).json({ 
      success: false,
      error: 'Missing required fields',
      message: 'URL, username, and password are required'
    });
  }

  // Validate URL is NASA domain
  if (!url.includes('gesdisc.eosdis.nasa.gov')) {
    console.error('❌ Invalid URL domain:', url);
    return res.status(400).json({ 
      success: false,
      error: 'Invalid URL',
      message: 'Only NASA GES DISC URLs are allowed'
    });
  }

  try {
    console.log('🚀 Downloading from NASA...');

    // Create Basic Auth header
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');

    const startTime = Date.now();

    // Download from NASA
    const nasaResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'GLDAS-Downloader/1.0',
        'Accept': '*/*'
      },
      signal: AbortSignal.timeout(60000) // 60 seconds
    });

    const responseTime = Date.now() - startTime;

    console.log('📊 NASA Response:');
    console.log('   Status:', nasaResponse.status);
    console.log('   Status Text:', nasaResponse.statusText);
    console.log('   Time:', responseTime, 'ms');
    console.log('   Content-Type:', nasaResponse.headers.get('content-type'));

    // Handle authentication errors
    if (nasaResponse.status === 401) {
      console.error('❌ Authentication failed (401)');
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid NASA Earthdata credentials. Please check your username and password.'
      });
    }

    if (nasaResponse.status === 403) {
      console.error('❌ Access forbidden (403)');
      return res.status(403).json({
        success: false,
        error: 'Access forbidden',
        message: 'You need to approve the GES DISC DATA ARCHIVE application at https://urs.earthdata.nasa.gov'
      });
    }

    if (nasaResponse.status === 404) {
      console.error('❌ File not found (404)');
      return res.status(404).json({
        success: false,
        error: 'File not found',
        message: 'The requested GLDAS file does not exist. Check your date range.'
      });
    }

    if (!nasaResponse.ok) {
      console.error('❌ NASA returned error:', nasaResponse.status);
      return res.status(nasaResponse.status).json({
        success: false,
        error: `NASA returned ${nasaResponse.status}`,
        message: nasaResponse.statusText
      });
    }

    // Get binary data
    const buffer = await nasaResponse.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    console.log('✅ Download successful!');
    console.log('   File size:', buffer.byteLength, 'bytes');
    console.log('   Base64 size:', base64.length, 'characters\n');

    return res.status(200).json({
      success: true,
      data: base64,
      fileSize: buffer.byteLength,
      metadata: {
        responseTime: responseTime,
        dataSize: buffer.byteLength,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Download Error:', error);
    console.error('   Error Name:', error.name);
    console.error('   Error Message:', error.message, '\n');

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return res.status(504).json({ 
        success: false,
        error: 'Request timeout',
        message: 'The file download took too long. The file may be too large or the server is slow. Please try again.'
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

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.path} not found`);
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    availableEndpoints: [
      'POST /api/nasa-proxy',
      'POST /api/download-gldas',
      'GET /api/health'
    ]
  });
});

// Global error handler
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
  console.log('   NASA PROXY SERVER - RUNNING');
  console.log(' ============================================');
  console.log('');
  console.log(` ✅ Server: http://localhost:${PORT}`);
  console.log(` 📡 NASA Proxy: POST /api/nasa-proxy`);
  console.log(` 📥 GLDAS Downloads: POST /api/download-gldas`);
  console.log(` ❤️  Health Check: GET /api/health`);
  console.log('');
  console.log(' 📝 Make sure your frontend is configured to');
  console.log('    connect to these endpoints.');
  console.log('');
  console.log(' Press Ctrl+C to stop the server');
  console.log('');
  console.log('🚀 ============================================\n');
});
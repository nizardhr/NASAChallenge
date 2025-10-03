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

// ============================================================================
// GLDAS FILE DOWNLOAD ENDPOINT (WITH COMPLETE NASA OAUTH FLOW)
// ============================================================================

app.post('/api/download-gldas', async (req, res) => {
  console.log('\n📥 ========================================');
  console.log(' GLDAS FILE DOWNLOAD REQUEST');
  console.log('========================================');

  const { url, username, password } = req.body;

  console.log('📋 Request Details:');
  console.log('   URL:', url ? url.substring(0, 100) + '...' : 'missing');
  console.log('   Username:', username ? '***' + username.slice(-3) : 'missing');

  if (!url || !username || !password) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing required fields'
    });
  }

  if (!url.includes('gesdisc.eosdis.nasa.gov')) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid URL'
    });
  }

  try {
    console.log('🚀 Starting NASA OAuth authentication flow...');
    const startTime = Date.now();

    // Step 1: Initial request
    console.log('📍 Step 1: Initial request...');
    const step1Response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(10000)
    });

    console.log('   Status:', step1Response.status);

    if (step1Response.status !== 302 && step1Response.status !== 301) {
      throw new Error(`Expected redirect, got ${step1Response.status}`);
    }

    const authUrl = step1Response.headers.get('location');
    console.log('📍 Step 2: Auth URL received');

    // Step 2: Authenticate
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    const step2Response = await fetch(authUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'GLDAS-Downloader/1.0'
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(10000)
    });

    console.log('   Auth status:', step2Response.status);

    if (step2Response.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Get ALL cookies
    const allCookies = [];
    const setCookieHeaders = step2Response.headers.raw()['set-cookie'];
    if (setCookieHeaders) {
      allCookies.push(...setCookieHeaders);
    }

    console.log('   Cookies from auth:', allCookies.length);

    // Step 3: Follow redirect to data-redirect
    const redirectUrl = step2Response.headers.get('location');
    console.log('📍 Step 3: Data redirect URL received');

    let cookieString = allCookies
      .map(cookie => cookie.split(';')[0])
      .join('; ');

    const step3Response = await fetch(redirectUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'GLDAS-Downloader/1.0'
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(10000)
    });

    console.log('   Data redirect status:', step3Response.status);

    // Collect more cookies
    const moreCookies = step3Response.headers.raw()['set-cookie'];
    if (moreCookies) {
      allCookies.push(...moreCookies);
      cookieString = allCookies
        .map(cookie => cookie.split(';')[0])
        .join('; ');
      console.log('   Total cookies now:', allCookies.length);
    }

    // Step 4: Follow final redirect to actual file
    const finalUrl = step3Response.headers.get('location') || url;
    console.log('📍 Step 4: Downloading file...');

    const finalResponse = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'GLDAS-Downloader/1.0'
      },
      redirect: 'follow', // Follow any remaining redirects
      signal: AbortSignal.timeout(60000)
    });

    const responseTime = Date.now() - startTime;

    console.log('📊 Final Response:');
    console.log('   Status:', finalResponse.status);
    console.log('   Time:', responseTime, 'ms');
    console.log('   Content-Type:', finalResponse.headers.get('content-type'));

    if (!finalResponse.ok) {
      if (finalResponse.status === 401) {
        console.error('❌ Still unauthorized after full OAuth flow');
        console.error('   This usually means the session cookies are not being preserved correctly');
        return res.status(401).json({
          success: false,
          error: 'Authentication failed',
          message: 'Could not establish authenticated session with NASA. Your credentials are correct but the OAuth flow failed.'
        });
      }

      return res.status(finalResponse.status).json({
        success: false,
        error: `Download failed with status ${finalResponse.status}`
      });
    }

    // Success! Get the data
    const buffer = await finalResponse.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    console.log('✅ Download successful!');
    console.log('   File size:', buffer.byteLength, 'bytes\n');

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
    console.error('❌ Error:', error.message, '\n');

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return res.status(504).json({ 
        success: false,
        error: 'Timeout'
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
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
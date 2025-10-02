/**
 * ============================================================================
 * LOCAL DEVELOPMENT PROXY SERVER
 * ============================================================================
 * 
 * PURPOSE:
 * Runs a local Express server that hosts the NASA proxy endpoint
 * for development and testing before deployment.
 * 
 * USAGE:
 * 1. Install dependencies: npm install express cors
 * 2. Run server: node server.js
 * 3. Server runs on http://localhost:3001
 * 4. Your frontend connects to /api/nasa-proxy
 * 
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');

const app = express();

// Enable CORS for local development
app.use(cors({
  origin: 'http://localhost:5173', // Vite default port
  credentials: true
}));

// Parse JSON request bodies
app.use(express.json());

// Import the proxy handler
// Note: Since we're using ES modules in the API file, we'll rewrite it here
app.post('/api/nasa-proxy', async (req, res) => {
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { url, username, password } = req.body;

    console.log('📡 Local Proxy: Request received');
    console.log('   Target:', url ? url.substring(0, 80) + '...' : 'missing');

    // Validate
    if (!url || !username || !password) {
      return res.status(400).json({ 
        error: 'Missing parameters',
        message: 'url, username, and password are required'
      });
    }

    // Validate URL domain
    if (!url.includes('gesdisc.eosdis.nasa.gov')) {
      return res.status(400).json({ 
        error: 'Invalid URL',
        message: 'Only NASA GES DISC URLs are allowed'
      });
    }

    console.log('🚀 Local Proxy: Forwarding to NASA...');

    // Make request to NASA
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    const startTime = Date.now();

    const nasaResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'WeatherProbabilityApp-LocalProxy/1.0',
        'Accept': 'text/plain, application/json, */*'
      },
      signal: AbortSignal.timeout(45000)
    });

    const responseTime = Date.now() - startTime;
    const data = await nasaResponse.text();

    console.log('📊 Local Proxy: NASA Response');
    console.log('   Status:', nasaResponse.status);
    console.log('   Time:', responseTime, 'ms');
    console.log('   Data size:', data.length, 'bytes');

    // Return response
    if (nasaResponse.status === 200) {
      console.log('✅ Local Proxy: Success');
      
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
    } else {
      console.error('❌ Local Proxy: NASA returned', nasaResponse.status);
      
      return res.status(nasaResponse.status).json({
        status: nasaResponse.status,
        success: false,
        error: `NASA API error: ${nasaResponse.statusText}`,
        data: data.substring(0, 500)
      });
    }

  } catch (error) {
    console.error('❌ Local Proxy Error:', error.message);
    
    return res.status(500).json({ 
      error: 'Proxy error',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'NASA Proxy Server',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log('   NASA PROXY SERVER - LOCAL DEVELOPMENT');
  console.log('   ========================================');
  console.log('');
  console.log('   ✅ Server running on port:', PORT);
  console.log('   🔗 Proxy endpoint: http://localhost:' + PORT + '/api/nasa-proxy');
  console.log('   ❤️  Health check: http://localhost:' + PORT + '/api/health');
  console.log('');
  console.log('   📝 Frontend should connect to: /api/nasa-proxy');
  console.log('   🌐 Make sure your Vite dev server is running on port 5173');
  console.log('');
  console.log('🚀 ========================================');
  console.log('');
});
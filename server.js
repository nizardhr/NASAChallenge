import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// ============================================================================
// Middleware
// ============================================================================

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// Routes
// ============================================================================

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('✅ Health check requested');
  res.json({
    status: 'healthy',
    service: 'NASA Proxy Server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// NASA Proxy endpoint
app.post('/api/nasa-proxy', async (req, res) => {
  console.log('\n📡 ========================================');
  console.log(' NASA PROXY REQUEST RECEIVED');
  console.log('========================================');

  try {
    const { url, username, password } = req.body;

    console.log('📋 Request Details:');
    console.log(' URL:', url ? url.substring(0, 80) + '...' : 'MISSING');
    console.log(' Username:', username ? '***' + username.slice(-3) : 'MISSING');
    console.log(' Password:', password ? '***' : 'MISSING');

    // Validate required fields
    if (!url) {
      console.error('❌ Error: Missing URL');
      return res.status(400).json({
        error: 'Missing parameter',
        message: 'URL is required',
      });
    }

    if (!username || !password) {
      console.error('❌ Error: Missing credentials');
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Username and password are required',
      });
    }

    // Validate URL domain
    if (!url.includes('gesdisc.eosdis.nasa.gov')) {
      console.error('❌ Error: Invalid URL domain');
      return res.status(400).json({
        error: 'Invalid URL',
        message: 'Only NASA GES DISC URLs are allowed',
      });
    }

    console.log('🚀 Forwarding request to NASA...');
    // Create Basic Auth credentials
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');

    const startTime = Date.now();
    // Make request to NASA
    const nasaResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'WeatherProbabilityApp-LocalProxy/1.0',
        'Accept': 'text/plain, application/json, */*'
      },
      signal: AbortSignal.timeout(45000) // 45 second timeout
    });

    const responseTime = Date.now() - startTime;
    const data = await nasaResponse.text();

    console.log('📊 NASA Response:');
    console.log(' Status:', nasaResponse.status);
    console.log(' Time:', responseTime, 'ms');
    console.log(' Data Size:', data.length, 'bytes');
    console.log(' Preview:', data.substring(0, 100).replace(/\n/g, ' '));

    // Return response to frontend
    if (nasaResponse.status === 200) {
      console.log('✅ Success - Returning data to frontend\n');
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
    } else if (nasaResponse.status === 401) {
      console.error('❌ Authentication failed - Invalid credentials\n');
      return res.status(401).json({
        status: 401,
        success: false,
        error: 'Invalid NASA Earthdata credentials',
        message: 'The username or password is incorrect'
      });
    } else if (nasaResponse.status === 403) {
      console.error('❌ Access forbidden\n');
      return res.status(403).json({
        status: 403,
        success: false,
        error: 'Access forbidden',
        message: 'Your account may need additional permissions'
      });
    } else {
      console.error('❌ Unexpected status:', nasaResponse.status, '\n');
      return res.status(nasaResponse.status).json({
        status: nasaResponse.status,
        success: false,
        error: `NASA API error: ${nasaResponse.statusText}`,
        message: data.substring(0, 500)
      });
    }
  } catch (error) {
    console.error('❌ Proxy Error:', error.name, '-', error.message, '\n');

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

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
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
  console.log(' NASA PROXY SERVER - LOCAL DEVELOPMENT');
  console.log(' ============================================');
  console.log('');
  console.log(` ✅ Server running on port: ${PORT}`);
  console.log(` 🔗 Proxy endpoint: http://localhost:${PORT}/api/nasa-proxy`);
  console.log(` ❤️ Health check: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log(' 📝 Frontend connects to: /api/nasa-proxy');
  console.log(' 🌐 Vite dev server should run on port 5173');
  console.log('');
  console.log(' Press Ctrl+C to stop the server');
  console.log('');
  console.log('🚀 ============================================\n');
});

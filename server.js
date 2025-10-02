const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// NASA Proxy
app.post('/api/nasa-proxy', async (req, res) => {
  console.log('\n📡 NASA Proxy Request');
  
  try {
    const { url, username, password } = req.body;

    if (!url || !username || !password) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    if (!url.includes('gesdisc.eosdis.nasa.gov')) {
      return res.status(400).json({ error: 'Invalid URL domain' });
    }

    console.log('🚀 Forwarding to NASA...');
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    const startTime = Date.now();

    const nasaResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'WeatherApp-LocalProxy/1.0',
        'Accept': 'text/plain, application/json, */*'
      },
      signal: AbortSignal.timeout(45000)
    });

    const responseTime = Date.now() - startTime;
    const data = await nasaResponse.text();

    console.log('📊 Response:', nasaResponse.status, '|', responseTime, 'ms |', data.length, 'bytes');

    if (nasaResponse.status === 200) {
      return res.status(200).json({
        status: 200,
        success: true,
        data: data,
        metadata: {
          responseTime,
          dataSize: data.length,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      return res.status(nasaResponse.status).json({
        status: nasaResponse.status,
        success: false,
        error: `NASA API error: ${nasaResponse.statusText}`,
        message: data.substring(0, 500)
      });
    }

  } catch (error) {
    console.error('❌ Proxy Error:', error.message);
    return res.status(500).json({ 
      error: 'Proxy error',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log('\n🚀 ========================================');
  console.log('   NASA PROXY SERVER - LOCAL DEV');
  console.log('   ========================================');
  console.log(`   ✅ Running on: http://localhost:${PORT}`);
  console.log(`   🔗 Proxy: http://localhost:${PORT}/api/nasa-proxy`);
  console.log(`   ❤️  Health: http://localhost:${PORT}/api/health`);
  console.log('   ========================================\n');
});
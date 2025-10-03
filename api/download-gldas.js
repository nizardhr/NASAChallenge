import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

app.post('/api/download-gldas', async (req, res) => {
  const { url, username, password } = req.body;

  // Validate inputs
  if (!url || !username || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Create Basic Auth header
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');

    // Download from NASA
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'GLDAS-Downloader/1.0'
      },
      timeout: 60000 // 60 seconds
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `NASA returned ${response.status}`,
        message: response.statusText
      });
    }

    // Get binary data
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    res.json({
      success: true,
      data: base64,
      fileSize: buffer.byteLength
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => console.log('Proxy running on port 3001'));

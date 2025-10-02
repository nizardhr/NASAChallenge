/**
 * ============================================================================
 * NASA API PROXY SERVER
 * ============================================================================
 * 
 * PURPOSE:
 * Acts as a proxy between the frontend and NASA's GES DISC API to bypass
 * CORS (Cross-Origin Resource Sharing) restrictions that prevent direct
 * browser access to NASA's data services.
 * 
 * HOW IT WORKS:
 * 1. Frontend sends request to this proxy with NASA credentials
 * 2. Proxy makes server-side request to NASA (no CORS issues)
 * 3. Proxy returns NASA's response to frontend
 * 
 * DEPLOYMENT:
 * - Vercel: Place in /api folder (automatically deployed as serverless function)
 * - Netlify: Place in /netlify/functions folder
 * - Node.js: Use as Express middleware
 * 
 * SECURITY:
 * - Credentials are passed through but not stored
 * - HTTPS recommended for production
 * - Rate limiting recommended
 * 
 * ============================================================================
 */

/**
 * Main proxy handler function
 * This runs as a serverless function on deployment platforms
 */
export default async function handler(req, res) {
  
  // ========================================================================
  // CORS HEADERS - Allow frontend to communicate with this endpoint
  // ========================================================================
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); // In production, replace * with your domain
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');

  // ========================================================================
  // HANDLE PREFLIGHT REQUESTS
  // ========================================================================
  
  // Browsers send OPTIONS request before POST to check CORS permissions
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling preflight OPTIONS request');
    res.status(200).end();
    return;
  }

  // ========================================================================
  // VALIDATE REQUEST METHOD
  // ========================================================================
  
  if (req.method !== 'POST') {
    console.error('❌ Invalid method:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests'
    });
  }

  // ========================================================================
  // VALIDATE REQUEST BODY
  // ========================================================================
  
  try {
    const { url, username, password } = req.body;

    // Log request (without sensitive data)
    console.log('📡 NASA Proxy Request Received');
    console.log('   Target URL:', url ? url.substring(0, 100) + '...' : 'missing');
    console.log('   Username:', username ? '***' + username.slice(-3) : 'missing');
    console.log('   Password:', password ? '***' : 'missing');

    // Validate required parameters
    if (!url) {
      return res.status(400).json({ 
        error: 'Missing parameter',
        message: 'URL is required'
      });
    }

    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Missing credentials',
        message: 'NASA Earthdata username and password are required'
      });
    }

    // Validate URL is NASA domain (security check)
    if (!url.includes('gesdisc.eosdis.nasa.gov')) {
      console.error('❌ Invalid URL domain:', url);
      return res.status(400).json({ 
        error: 'Invalid URL',
        message: 'Only NASA GES DISC URLs are allowed'
      });
    }

    // ========================================================================
    // MAKE REQUEST TO NASA API
    // ========================================================================

    console.log('🚀 Forwarding request to NASA...');

    // Create Basic Authentication header
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    
    const startTime = Date.now();

    // Make server-side request to NASA (no CORS restrictions)
    const nasaResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'WeatherProbabilityApp-Proxy/1.0',
        'Accept': 'text/plain, application/json, */*'
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(45000) // 45 seconds
    });

    const responseTime = Date.now() - startTime;

    console.log('📊 NASA Response Received');
    console.log('   Status:', nasaResponse.status);
    console.log('   Status Text:', nasaResponse.statusText);
    console.log('   Response Time:', responseTime, 'ms');
    console.log('   Content-Type:', nasaResponse.headers.get('content-type'));

    // ========================================================================
    // PROCESS NASA RESPONSE
    // ========================================================================

    // Get response data as text (NASA returns ASCII data)
    const data = await nasaResponse.text();
    
    console.log('   Data Length:', data.length, 'bytes');
    console.log('   Data Preview:', data.substring(0, 150).replace(/\n/g, ' '));

    // ========================================================================
    // RETURN RESPONSE TO FRONTEND
    // ========================================================================

    if (nasaResponse.status === 200) {
      console.log('✅ Success - Returning data to frontend');
      
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
    } 
    else if (nasaResponse.status === 401) {
      console.error('❌ Authentication failed - Invalid credentials');
      
      return res.status(401).json({
        status: 401,
        success: false,
        error: 'Invalid NASA Earthdata credentials',
        message: 'The username or password is incorrect. Please verify your credentials at https://urs.earthdata.nasa.gov'
      });
    }
    else if (nasaResponse.status === 403) {
      console.error('❌ Access forbidden');
      
      return res.status(403).json({
        status: 403,
        success: false,
        error: 'Access forbidden',
        message: 'Your NASA Earthdata account may need additional permissions or verification.'
      });
    }
    else if (nasaResponse.status === 503 || nasaResponse.status === 504) {
      console.error('❌ NASA service unavailable');
      
      return res.status(503).json({
        status: nasaResponse.status,
        success: false,
        error: 'NASA service temporarily unavailable',
        message: 'NASA servers are experiencing high load. Please try again in a few minutes.'
      });
    }
    else {
      console.error('❌ Unexpected status:', nasaResponse.status);
      
      return res.status(nasaResponse.status).json({
        status: nasaResponse.status,
        success: false,
        error: `NASA API error: ${nasaResponse.statusText}`,
        data: data.substring(0, 500) // Return partial data for debugging
      });
    }

  } catch (error) {
    
    // ========================================================================
    // ERROR HANDLING
    // ========================================================================
    
    console.error('❌ Proxy Error:', error);
    console.error('   Error Name:', error.name);
    console.error('   Error Message:', error.message);
    
    // Handle specific error types
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return res.status(504).json({ 
        error: 'Request timeout',
        message: 'The request to NASA took too long. Please try again.',
        details: 'Timeout after 45 seconds'
      });
    }
    
    if (error.message && error.message.includes('fetch')) {
      return res.status(502).json({ 
        error: 'Cannot reach NASA servers',
        message: 'Unable to connect to NASA GES DISC. The service may be temporarily unavailable.',
        details: error.message
      });
    }
    
    // Generic error response
    return res.status(500).json({ 
      error: 'Internal proxy error',
      message: 'An unexpected error occurred while processing your request',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
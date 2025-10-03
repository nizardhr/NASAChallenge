/**
 * ============================================================================
 * NASA EARTHDATA AUTHENTICATION SERVICE (PROXY VERSION)
 * ============================================================================
 * 
 * PURPOSE:
 * Handles authentication with NASA's Earthdata Login (URS) system through
 * a backend proxy server to bypass CORS restrictions.
 * 
 * AUTHENTICATION FLOW:
 * 1. User provides NASA credentials
 * 2. Frontend sends credentials to backend proxy
 * 3. Proxy authenticates with NASA and returns result
 * 4. Frontend stores credentials for subsequent requests
 * 
 * ============================================================================
 */

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

interface NASAAuthConfig {
  username: string;
  password: string;
}

interface AuthStatus {
  authenticated: boolean;
  username?: string;
  lastAuthenticated?: Date;
  sessionExpiry?: Date;
}

interface ProxyResponse {
  status: number;
  success: boolean;
  data?: string;
  error?: string;
  message?: string;
  metadata?: {
    responseTime: number;
    dataSize: number;
    timestamp: string;
  };
}

// ============================================================================
// MAIN AUTHENTICATION SERVICE CLASS
// ============================================================================

export class NASAAuthService {
  
  // ========================================================================
  // PRIVATE PROPERTIES
  // ========================================================================
  
  private username: string = '';
  private password: string = '';
  private authenticated: boolean = false;
  private lastAuthTime: Date | null = null;
  
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly PROXY_ENDPOINT = '/api/nasa-proxy';

  // ========================================================================
  // PUBLIC METHODS
  // ========================================================================

  /**
   * Authenticate with NASA Earthdata via backend proxy
   */
  async authenticate(config: NASAAuthConfig): Promise<void> {
    console.log('🔐 Authenticating with NASA Earthdata (via proxy)...');
    console.log('   Username:', config.username);
    console.log('   Using proxy endpoint:', this.PROXY_ENDPOINT);

    // Validate input
    if (!config.username || !config.password) {
      throw new Error('Username and password are required');
    }

    if (config.username.trim().length === 0 || config.password.trim().length === 0) {
      throw new Error('Username and password cannot be empty');
    }

    // Store credentials
    this.username = config.username.trim();
    this.password = config.password;

    try {
      // Build test URL - minimal data request to verify credentials
      const testUrl = this.buildTestUrl();

      console.log('   📡 Sending authentication request to proxy...');

      const startTime = Date.now();

      // Send request through our proxy
      const response = await fetch(this.PROXY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: testUrl,
          username: this.username,
          password: this.password
        })
      });

      const requestTime = Date.now() - startTime;

      console.log('   ⏱️  Proxy response time:', requestTime, 'ms');

      // Parse proxy response
      const result: ProxyResponse = await response.json();

      console.log('   📊 Proxy response status:', result.status);
      console.log('   📊 Success flag:', result.success);

      // ====================================================================
      // HANDLE RESPONSE
      // ====================================================================

      if (result.success && result.status === 200) {
        // SUCCESS - Authentication verified
        
        if (result.data && result.data.length > 0) {
          console.log('   📄 Data received:', result.data.length, 'bytes');
          console.log('   📄 Data preview:', result.data.substring(0, 100));
        }
        
        this.authenticated = true;
        this.lastAuthTime = new Date();
        
        console.log('✅ NASA Earthdata authentication successful!');
        console.log('   ✓ Credentials verified');
        console.log('   ✓ Data access confirmed');
        console.log('   ✓ Session established');
        console.log('   ⏰ Session valid until:', this.getSessionExpiry().toLocaleString());
        
        if (result.metadata) {
          console.log('   📊 NASA response time:', result.metadata.responseTime, 'ms');
        }
        
        return;
      }
      else if (result.status === 401) {
        // UNAUTHORIZED - Invalid credentials
        this.authenticated = false;
        
        console.error('❌ Authentication failed - 401 Unauthorized');
        console.error('   Message:', result.message || result.error);
        
        throw new Error(
          'Invalid NASA Earthdata credentials.\n\n' +
          'Please verify:\n' +
          '1. Username is correct (case-sensitive)\n' +
          '2. Password is correct\n' +
          '3. Account is verified - check your email\n' +
          '4. You can login at https://urs.earthdata.nasa.gov\n\n' +
          'If you forgot your password, reset it at:\n' +
          'https://urs.earthdata.nasa.gov/users/password/new'
        );
      }
      else if (result.status === 403) {
        // FORBIDDEN
        this.authenticated = false;
        
        console.error('❌ Authentication failed - 403 Forbidden');
        console.error('   Message:', result.message || result.error);
        
        throw new Error(
          'Access forbidden.\n\n' +
          'Your NASA Earthdata account may need:\n' +
          '1. Email verification\n' +
          '2. Additional permissions\n' +
          '3. Terms of service acceptance\n\n' +
          'Please visit https://urs.earthdata.nasa.gov to verify your account.'
        );
      }
      else if (result.status === 503 || result.status === 504) {
        // SERVICE UNAVAILABLE
        this.authenticated = false;
        
        console.error('❌ NASA service temporarily unavailable');
        console.error('   Status:', result.status);
        
        throw new Error(
          'NASA GES DISC servers are temporarily unavailable.\n\n' +
          'Please try again in a few minutes.\n' +
          'Check NASA status: https://earthdata.nasa.gov/eosdis/system-performance'
        );
      }
      else {
        // OTHER ERRORS
        this.authenticated = false;
        
        console.error('❌ Unexpected response');
        console.error('   Status:', result.status);
        console.error('   Error:', result.error);
        console.error('   Message:', result.message);
        
        throw new Error(
          `Authentication failed with status ${result.status}\n\n` +
          (result.message || result.error || 'Unknown error occurred') +
          '\n\nPlease try again later.'
        );
      }

    } catch (error: any) {
      this.authenticated = false;
      
      console.error('❌ Authentication error:', error);
      
      // Handle network errors
      if (error.message && error.message.includes('fetch')) {
        throw new Error(
          'Cannot reach proxy server.\n\n' +
          'Please check:\n' +
          '1. Your internet connection\n' +
          '2. The proxy server is running\n' +
          '3. Firewall settings\n\n' +
          'Technical details: ' + error.message
        );
      }
      
      // Re-throw formatted errors
      if (error.message.includes('NASA Earthdata') ||
          error.message.includes('Invalid') ||
          error.message.includes('forbidden') ||
          error.message.includes('unavailable')) {
        throw error;
      }
      
      // Generic error
      throw new Error(
        `Authentication failed: ${error.message}\n\n` +
        'Please try again or contact support if the issue persists.'
      );
    }
  }

  /**
   * Get authentication headers for NASA API requests
   * Returns credentials for proxy to use
   */
  getAuthHeaders(): Record<string, string> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated. Please login first.');
    }

    if (this.isSessionExpired()) {
      this.authenticated = false;
      throw new Error(
        'Session expired. Please authenticate again.\n' +
        'Sessions are valid for 24 hours.'
      );
    }

    // Return empty headers since proxy will handle auth
    // But store credentials for proxy requests
    return {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Get credentials for proxy requests
   * Used internally by data fetching services
   */
  getCredentials(): { username: string; password: string } {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    return {
      username: this.username,
      password: this.password
    };
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): boolean {
    return (
      this.authenticated &&
      this.username !== '' &&
      this.password !== '' &&
      !this.isSessionExpired()
    );
  }

  /**
   * Get current authentication status
   */
  getAuthStatus(): AuthStatus {
    return {
      authenticated: this.isAuthenticated(),
      username: this.isAuthenticated() ? this.username : undefined,
      lastAuthenticated: this.lastAuthTime || undefined,
      sessionExpiry: this.lastAuthTime ? this.getSessionExpiry() : undefined
    };
  }

  /**
   * Logout and clear credentials
   */
  logout(): void {
    console.log('🔓 Logging out from NASA Earthdata...');
    
    this.username = '';
    this.password = '';
    this.authenticated = false;
    this.lastAuthTime = null;
    
    console.log('✅ Logged out successfully');
  }

  /**
   * Test authentication
   */
  async testAuthentication(): Promise<boolean> {
    console.log('🧪 Testing NASA authentication via proxy...');
    
    if (!this.authenticated || this.isSessionExpired()) {
      console.log('❌ Not authenticated or session expired');
      return false;
    }

    try {
      const testUrl = this.buildTestUrl();

      const response = await fetch(this.PROXY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: testUrl,
          username: this.username,
          password: this.password
        })
      });

      const result: ProxyResponse = await response.json();

      const success = result.success && result.status === 200;
      
      console.log(success ? '✅ Test successful' : '❌ Test failed');
      
      return success;
      
    } catch (error: any) {
      console.error('❌ Test error:', error.message);
      return false;
    }
  }

  /**
   * Get proxy endpoint URL
   */
  getProxyEndpoint(): string {
    return this.PROXY_ENDPOINT;
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  private buildTestUrl(): string {
  // Use Data Rods API with proper parameters format
  const params = {
    FILENAME: '/data/GLDAS/GLDAS_NOAH025_3H.2.1',
    SERVICE: 'SUBSET_GLDAS',
    VERSION: '1.02',
    DATASET: 'GLDAS_NOAH025_3H.2.1',
    VARIABLES: 'Tair_f_inst',
    WEST: '-100.0',
    EAST: '-100.0',
    SOUTH: '40.0',
    NORTH: '40.0',
    STARTDATE: '2023-01-01T00:00',
    ENDDATE: '2023-01-02T00:00',
    FORMAT: 'bmM0Lw'
  };

  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return `https://hydro1.gesdisc.eosdis.nasa.gov/daac-bin/OTF/HTTP_services.cgi?${queryString}`;
}

  private getSessionExpiry(): Date {
    if (!this.lastAuthTime) {
      return new Date();
    }
    return new Date(this.lastAuthTime.getTime() + this.SESSION_DURATION);
  }

  private isSessionExpired(): boolean {
    if (!this.lastAuthTime) {
      return true;
    }
    return Date.now() >= (this.lastAuthTime.getTime() + this.SESSION_DURATION);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const nasaAuthService = new NASAAuthService();
// src/services/nasaAuth.ts

/**
 * ============================================================================
 * NASA EARTHDATA AUTHENTICATION SERVICE
 * ============================================================================
 * 
 * PURPOSE:
 * Handles authentication with NASA's Earthdata Login (URS) system for
 * accessing GES DISC data services, specifically GLDAS and NLDAS datasets
 * via the Data Rods API.
 * 
 * AUTHENTICATION METHOD:
 * HTTP Basic Authentication with NASA Earthdata credentials
 * 
 * SUPPORTED SERVICES:
 * - GES DISC Data Rods API (hydro1.gesdisc.eosdis.nasa.gov)
 * - GLDAS (Global Land Data Assimilation System)
 * - NLDAS (North American Land Data Assimilation System)
 * 
 * REGISTRATION:
 * Free NASA Earthdata account required: https://urs.earthdata.nasa.gov/users/new
 * 
 * AUTHOR: Weather Probability Application
 * CREATED: 2025
 * LAST MODIFIED: 2025-01-09
 * VERSION: 2.0.0
 * 
 * ============================================================================
 */

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

/**
 * NASA Earthdata authentication configuration
 */
interface NASAAuthConfig {
  username: string;
  password: string;
}

/**
 * Authentication status response
 */
interface AuthStatus {
  authenticated: boolean;
  username?: string;
  lastAuthenticated?: Date;
  nextRefreshNeeded?: Date;
}

/**
 * Authentication test result
 */
interface AuthTestResult {
  success: boolean;
  responseTime?: number;
  dataReceived?: boolean;
  error?: string;
}

// ============================================================================
// MAIN AUTHENTICATION SERVICE CLASS
// ============================================================================

export class NASAAuthService {
  // ========================================================================
  // PRIVATE PROPERTIES
  // ========================================================================
  
  /**
   * Stored username for authenticated session
   */
  private username: string = '';
  
  /**
   * Stored password for authenticated session (in memory only)
   */
  private password: string = '';
  
  /**
   * Authentication status flag
   */
  private authenticated: boolean = false;
  
  /**
   * Timestamp of last successful authentication
   */
  private lastAuthTime: Date | null = null;
  
  /**
   * Session duration in milliseconds (24 hours)
   */
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000;
  
  /**
   * Base URL for GES DISC Data Rods API
   */
  private readonly GES_DISC_BASE_URL = 'https://hydro1.gesdisc.eosdis.nasa.gov/daac-bin/access/timeseries.cgi';

  // ========================================================================
  // PUBLIC METHODS
  // ========================================================================

  /**
   * Authenticate with NASA Earthdata
   * 
   * This method validates credentials by making a test request to the
   * GES DISC Data Rods API. If the request succeeds, credentials are
   * stored for future use.
   * 
   * @param config - NASA Earthdata username and password
   * @throws Error if authentication fails or network issues occur
   * 
   * @example
   * await nasaAuthService.authenticate({
   *   username: 'your_nasa_username',
   *   password: 'your_nasa_password'
   * });
   */
  async authenticate(config: NASAAuthConfig): Promise<void> {
    console.log('🔐 Authenticating with NASA Earthdata...');
    console.log('   Username:', config.username);
    console.log('   Target: GES DISC Data Rods API');

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
      // Build test URL - request minimal data to verify credentials
      const testUrl = this.buildTestUrl();

      console.log('   📡 Testing credentials with GES DISC Data Rods...');
      console.log('   🔗 Endpoint:', this.GES_DISC_BASE_URL);

      const startTime = Date.now();

      // Make authenticated request
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: this.buildAuthHeaders(),
        credentials: 'include', // Include cookies for session management
        // Add timeout handling
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      const responseTime = Date.now() - startTime;

      console.log('   📊 Response Status:', response.status);
      console.log('   ⏱️  Response Time:', responseTime, 'ms');
      console.log('   📋 Content-Type:', response.headers.get('content-type'));

      // Handle different response statuses
      if (response.status === 200) {
        // SUCCESS - Authentication verified
        const data = await response.text();
        
        console.log('   📊 Response Length:', data.length, 'bytes');
        console.log('   📄 Data Preview:', data.substring(0, 150).replace(/\n/g, ' '));
        
        // Verify we actually received data
        if (data.length > 0 && !data.includes('Error') && !data.includes('error')) {
          this.authenticated = true;
          this.lastAuthTime = new Date();
          
          console.log('✅ NASA Earthdata authentication successful!');
          console.log('   ✓ Credentials verified');
          console.log('   ✓ Data access confirmed');
          console.log('   ✓ Session established');
          console.log('   ⏰ Session valid until:', this.getSessionExpiry().toLocaleString());
          
          return;
        } else {
          // Received 200 but data looks like an error
          console.error('⚠️  Received 200 but data appears invalid');
          console.error('   Data:', data.substring(0, 500));
          throw new Error('Authentication succeeded but data retrieval failed. Please try again.');
        }
        
      } else if (response.status === 401) {
        // UNAUTHORIZED - Invalid credentials
        this.authenticated = false;
        const errorText = await response.text().catch(() => 'No error details available');
        
        console.error('❌ Authentication failed - 401 Unauthorized');
        console.error('   This means your credentials are incorrect');
        console.error('   Response:', errorText.substring(0, 300));
        
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
        
      } else if (response.status === 403) {
        // FORBIDDEN - Account may lack permissions
        this.authenticated = false;
        const errorText = await response.text().catch(() => 'No error details available');
        
        console.error('❌ Authentication failed - 403 Forbidden');
        console.error('   Your account may need additional permissions');
        console.error('   Response:', errorText.substring(0, 300));
        
        throw new Error(
          'Access forbidden. Your NASA Earthdata account may need additional permissions.\n\n' +
          'Please:\n' +
          '1. Verify your account at https://urs.earthdata.nasa.gov\n' +
          '2. Check if email is confirmed\n' +
          '3. Contact NASA support if issue persists'
        );
        
      } else if (response.status === 503 || response.status === 504) {
        // SERVICE UNAVAILABLE - NASA servers may be down
        this.authenticated = false;
        
        console.error('❌ NASA service temporarily unavailable');
        console.error('   Status:', response.status);
        
        throw new Error(
          'NASA GES DISC servers are temporarily unavailable.\n\n' +
          'Please try again in a few minutes.\n' +
          'Check NASA status: https://earthdata.nasa.gov/eosdis/system-performance'
        );
        
      } else {
        // OTHER ERRORS
        this.authenticated = false;
        const errorText = await response.text().catch(() => 'No error details available');
        
        console.error('❌ Unexpected response from NASA');
        console.error('   Status:', response.status);
        console.error('   Status Text:', response.statusText);
        console.error('   Response:', errorText.substring(0, 500));
        
        throw new Error(
          `NASA API returned status ${response.status}: ${response.statusText}\n\n` +
          'Please try again later or contact support if the issue persists.'
        );
      }

    } catch (error: any) {
      this.authenticated = false;
      
      console.error('❌ NASA authentication error:', error);
      
      // Handle specific error types
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        throw new Error(
          'Authentication request timed out.\n\n' +
          'This may be due to:\n' +
          '1. Slow internet connection\n' +
          '2. NASA servers experiencing high load\n' +
          '3. Network firewall blocking requests\n\n' +
          'Please check your connection and try again.'
        );
      }
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(
          'Cannot reach NASA servers.\n\n' +
          'Please check:\n' +
          '1. Your internet connection\n' +
          '2. Firewall settings\n' +
          '3. VPN configuration (if using)\n\n' +
          'Network error: ' + error.message
        );
      }
      
      // Re-throw if already formatted
      if (error.message.includes('NASA Earthdata') || 
          error.message.includes('Invalid') || 
          error.message.includes('forbidden')) {
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
   * 
   * Returns HTTP headers with Basic Authentication credentials
   * encoded in base64 format.
   * 
   * @returns Headers object with Authorization and other required headers
   * @throws Error if not authenticated
   * 
   * @example
   * const headers = nasaAuthService.getAuthHeaders();
   * fetch(url, { headers });
   */
  getAuthHeaders(): Record<string, string> {
    if (!this.isAuthenticated()) {
      throw new Error(
        'Not authenticated. Please login first using authenticate() method.'
      );
    }

    // Check if session expired
    if (this.isSessionExpired()) {
      this.authenticated = false;
      throw new Error(
        'Session expired. Please authenticate again.\n' +
        'Sessions are valid for 24 hours.'
      );
    }

    return this.buildAuthHeaders();
  }

  /**
   * Check if user is currently authenticated
   * 
   * @returns True if authenticated and session is valid
   * 
   * @example
   * if (nasaAuthService.isAuthenticated()) {
   *   // Proceed with data fetch
   * }
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
   * Get current authentication status with details
   * 
   * @returns Authentication status object with details
   * 
   * @example
   * const status = nasaAuthService.getAuthStatus();
   * console.log('Authenticated:', status.authenticated);
   * console.log('Username:', status.username);
   */
  getAuthStatus(): AuthStatus {
    return {
      authenticated: this.isAuthenticated(),
      username: this.isAuthenticated() ? this.username : undefined,
      lastAuthenticated: this.lastAuthTime || undefined,
      nextRefreshNeeded: this.lastAuthTime ? this.getSessionExpiry() : undefined
    };
  }

  /**
   * Logout and clear all authentication data
   * 
   * Clears username, password, and authentication status.
   * All stored credentials are removed from memory.
   * 
   * @example
   * nasaAuthService.logout();
   */
  logout(): void {
    console.log('🔓 Logging out from NASA Earthdata...');
    
    this.username = '';
    this.password = '';
    this.authenticated = false;
    this.lastAuthTime = null;
    
    console.log('✅ Logged out successfully');
    console.log('   All credentials cleared from memory');
  }

  /**
   * Test authentication without throwing errors
   * 
   * Makes a lightweight test request to verify credentials
   * are still valid. Useful for checking session status.
   * 
   * @returns Test result with success status and details
   * 
   * @example
   * const result = await nasaAuthService.testAuthentication();
   * if (result.success) {
   *   console.log('Authentication valid');
   * }
   */
  async testAuthentication(): Promise<AuthTestResult> {
    console.log('🧪 Testing NASA authentication...');
    
    if (!this.authenticated) {
      console.log('❌ Not authenticated');
      return {
        success: false,
        error: 'Not authenticated'
      };
    }

    if (this.isSessionExpired()) {
      console.log('⚠️  Session expired');
      return {
        success: false,
        error: 'Session expired'
      };
    }

    try {
      const testUrl = this.buildTestUrl();
      const startTime = Date.now();

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: this.buildAuthHeaders(),
        signal: AbortSignal.timeout(15000) // 15 second timeout for test
      });

      const responseTime = Date.now() - startTime;

      if (response.status === 200) {
        const data = await response.text();
        const dataReceived = data.length > 0 && !data.includes('Error');
        
        console.log('✅ Authentication test successful');
        console.log('   Response time:', responseTime, 'ms');
        console.log('   Data received:', dataReceived);
        
        return {
          success: true,
          responseTime,
          dataReceived
        };
      } else {
        console.log('❌ Authentication test failed');
        console.log('   Status:', response.status);
        
        return {
          success: false,
          error: `HTTP ${response.status}`
        };
      }
      
    } catch (error: any) {
      console.error('❌ Authentication test error:', error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get session expiry time
   * 
   * @returns Date when current session expires
   */
  getSessionExpiry(): Date {
    if (!this.lastAuthTime) {
      return new Date();
    }
    return new Date(this.lastAuthTime.getTime() + this.SESSION_DURATION);
  }

  /**
   * Get remaining session time in milliseconds
   * 
   * @returns Milliseconds until session expires, or 0 if expired/not authenticated
   */
  getRemainingSessionTime(): number {
    if (!this.lastAuthTime) {
      return 0;
    }
    
    const expiryTime = this.getSessionExpiry().getTime();
    const remainingTime = expiryTime - Date.now();
    
    return Math.max(0, remainingTime);
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Build authentication headers
   * Creates HTTP Basic Authentication header
   */
  private buildAuthHeaders(): Record<string, string> {
    const credentials = btoa(`${this.username}:${this.password}`);
    
    return {
      'Authorization': `Basic ${credentials}`,
      'User-Agent': 'WeatherProbabilityApp/1.0',
      'Accept': 'text/plain, application/json, */*'
    };
  }

  /**
   * Build test URL for authentication verification
   * Uses minimal data request to verify credentials
   */
  private buildTestUrl(): string {
    // Request only 1 day of data from a single location to minimize response size
    const params = new URLSearchParams({
      variable: 'GLDAS2:GLDAS_NOAH025_3H_v2.1:Tair_f_inst',
      location: '40.0,-100.0', // Central USA
      startDate: '2023-01-01',
      endDate: '2023-01-01', // Just 1 day
      type: 'asc2'
    });

    return `${this.GES_DISC_BASE_URL}?${params.toString()}`;
  }

  /**
   * Check if current session has expired
   */
  private isSessionExpired(): boolean {
    if (!this.lastAuthTime) {
      return true;
    }

    const now = Date.now();
    const expiryTime = this.lastAuthTime.getTime() + this.SESSION_DURATION;
    
    return now >= expiryTime;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Singleton instance of NASA Authentication Service
 * Use this exported instance throughout your application
 * 
 * @example
 * import { nasaAuthService } from './services/nasaAuth';
 * 
 * await nasaAuthService.authenticate({
 *   username: 'your_username',
 *   password: 'your_password'
 * });
 */
export const nasaAuthService = new NASAAuthService();
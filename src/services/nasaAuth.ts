interface NASAAuthConfig {
  username: string;
  password: string;
}

interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

export class NASAAuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;
  
  // NASA Earthdata URLs
  private readonly authEndpoint = 'https://urs.earthdata.nasa.gov/oauth/authorize';
  private readonly tokenEndpoint = 'https://urs.earthdata.nasa.gov/oauth/token';
  
  // Use Basic Auth for simple username/password flow
  private readonly clientId = 'weather_app_client'; // Replace with your registered app

  /**
   * Authenticate with NASA Earthdata using username/password
   * This uses HTTP Basic Authentication which NASA supports
   */
  async authenticate(config: NASAAuthConfig): Promise<void> {
    try {
      console.log('🔐 Authenticating with NASA Earthdata...');

      // Method 1: Direct Basic Authentication (simplest for development)
      const credentials = btoa(`${config.username}:${config.password}`);
      
      // Test authentication by making a simple request to NASA
      const testUrl = 'https://cmr.earthdata.nasa.gov/search/collections.json?keyword=GLDAS';
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        // Store credentials for future requests
        this.accessToken = credentials;
        this.tokenExpiry = new Date(Date.now() + 86400000); // 24 hours
        
        console.log('✅ NASA Earthdata authentication successful');
        console.log('   Username:', config.username);
        console.log('   Token expires:', this.tokenExpiry.toLocaleString());
      } else {
        const errorText = await response.text();
        console.error('❌ Authentication failed:', response.status, errorText);
        throw new Error(`NASA authentication failed: ${response.status} - ${errorText}`);
      }

    } catch (error) {
      console.error('❌ NASA authentication error:', error);
      throw new Error(`Failed to authenticate with NASA Earthdata: ${error.message}`);
    }
  }

  /**
   * Get authentication headers for NASA API requests
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.accessToken || this.isTokenExpired()) {
      throw new Error('Not authenticated or token expired. Please login again.');
    }

    return {
      'Authorization': `Basic ${this.accessToken}`,
      'User-Agent': 'WeatherProbabilityApp/1.0',
      'Accept': 'application/json'
    };
  }

  /**
   * Check if current token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true;
    return new Date() >= this.tokenExpiry;
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null && !this.isTokenExpired();
  }

  /**
   * Get current authentication status for display
   */
  getAuthStatus(): { authenticated: boolean; username?: string; expiresAt?: Date } {
    return {
      authenticated: this.isAuthenticated(),
      expiresAt: this.tokenExpiry || undefined
    };
  }

  /**
   * Logout and clear authentication
   */
  logout(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    console.log('🔓 Logged out from NASA Earthdata');
  }

  /**
   * Test authentication by making a real NASA API call
   */
  async testAuthentication(): Promise<boolean> {
    try {
      if (!this.isAuthenticated()) {
        throw new Error('Not authenticated');
      }

      const headers = await this.getAuthHeaders();
      const testUrl = 'https://cmr.earthdata.nasa.gov/search/collections.json?keyword=GLDAS&page_size=1';
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: headers
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Authentication test successful');
        console.log('   Response:', data.feed?.entry?.length || 0, 'collections found');
        return true;
      } else {
        console.error('❌ Authentication test failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Authentication test error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const nasaAuthService = new NASAAuthService();
import React, { useState } from 'react';
import { nasaAuthService } from '../services/nasaAuth';

export const NASAAuthTest: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState(nasaAuthService.getAuthStatus());

  const handleLogin = async () => {
    if (!username || !password) {
      setStatus('❌ Please enter both username and password');
      return;
    }

    setIsLoading(true);
    setStatus('🔐 Authenticating with NASA Earthdata...');

    try {
      await nasaAuthService.authenticate({ username, password });
      setStatus('✅ Authentication successful!');
      setAuthStatus(nasaAuthService.getAuthStatus());
      
      // Test the authentication
      setStatus('🧪 Testing authentication...');
      const testResult = await nasaAuthService.testAuthentication();
      
      if (testResult) {
        setStatus('✅ Authentication verified! Ready to fetch NASA data.');
      } else {
        setStatus('⚠️ Authentication succeeded but test failed.');
      }
    } catch (error) {
      setStatus(`❌ Authentication failed: ${error.message}`);
      setAuthStatus(nasaAuthService.getAuthStatus());
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    nasaAuthService.logout();
    setAuthStatus(nasaAuthService.getAuthStatus());
    setStatus('🔓 Logged out');
    setUsername('');
    setPassword('');
  };

  return (
    <div className="nasa-auth-test glass-card" style={{ padding: '2rem', margin: '2rem auto', maxWidth: '500px' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>NASA Earthdata Authentication</h2>
      
      {!authStatus.authenticated ? (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              NASA Earthdata Username:
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_username"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '2px solid rgba(59, 130, 246, 0.3)',
                background: 'rgba(255, 255, 255, 0.05)',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              NASA Earthdata Password:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="your_password"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '2px solid rgba(59, 130, 246, 0.3)',
                background: 'rgba(255, 255, 255, 0.05)',
                fontSize: '1rem'
              }}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1
            }}
          >
            {isLoading ? 'Authenticating...' : 'Login to NASA Earthdata'}
          </button>
        </>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <p style={{ marginBottom: '1rem', color: '#10b981', fontWeight: '600' }}>
            Authenticated with NASA Earthdata
          </p>
          <p style={{ marginBottom: '1.5rem', fontSize: '0.875rem', opacity: 0.7 }}>
            Token expires: {authStatus.expiresAt?.toLocaleString()}
          </p>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '2px solid #ef4444',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      )}

      {status && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: status.includes('❌') 
              ? 'rgba(239, 68, 68, 0.1)' 
              : status.includes('✅') 
              ? 'rgba(16, 185, 129, 0.1)' 
              : 'rgba(59, 130, 246, 0.1)',
            borderRadius: '8px',
            fontSize: '0.875rem',
            whiteSpace: 'pre-line'
          }}
        >
          {status}
        </div>
      )}

      <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', fontSize: '0.875rem' }}>
        <strong>ℹ️ Need NASA Earthdata account?</strong>
        <p style={{ marginTop: '0.5rem' }}>
          Sign up for free at:{' '}
          <a 
            href="https://urs.earthdata.nasa.gov/users/new" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#3b82f6', textDecoration: 'underline' }}
          >
            https://urs.earthdata.nasa.gov/users/new
          </a>
        </p>
      </div>
    </div>
  );
};
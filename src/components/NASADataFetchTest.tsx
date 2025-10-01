import React, { useState } from 'react';
import { nasaAuthService } from '../services/nasaAuth';
import { nasaDataFetcher } from '../services/nasaDataService';

export const NASADataFetchTest: React.FC = () => {
  const [latitude, setLatitude] = useState('40.7128');
  const [longitude, setLongitude] = useState('-74.0060');
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [dataResults, setDataResults] = useState<any>(null);

  const handleFetchData = async () => {
    if (!nasaAuthService.isAuthenticated()) {
      setStatus('❌ Please authenticate with NASA first (see above)');
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setStatus('❌ Invalid coordinates. Lat: -90 to 90, Lng: -180 to 180');
      return;
    }

    setIsLoading(true);
    setStatus('🛰️ Fetching real NASA satellite data...\nThis may take 10-30 seconds...');
    setDataResults(null);

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1); // Last 1 year

      const timeSeries = await nasaDataFetcher.fetchHistoricalWeatherData(
        { lat, lng },
        startDate,
        endDate
      );

      const quality = nasaDataFetcher.getDataQuality(timeSeries);

      setDataResults({
        temperature: timeSeries.temperature.length,
        precipitation: timeSeries.precipitation.length,
        quality: quality
      });

      setStatus(
        `✅ NASA data fetched successfully!\n\n` +
        `Temperature data points: ${timeSeries.temperature.length}\n` +
        `Precipitation data points: ${timeSeries.precipitation.length}\n` +
        `Date range: ${quality.dateRange.start.toLocaleDateString()} to ${quality.dateRange.end.toLocaleDateString()}\n\n` +
        `Sample temperature values:\n` +
        timeSeries.temperature.slice(0, 5).map(p => 
          `  ${p.date.toLocaleDateString()}: ${p.value.toFixed(2)}°C`
        ).join('\n')
      );

    } catch (error) {
      setStatus(`❌ Data fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nCommon issues:\n• Authentication expired (re-login above)\n• NASA servers temporarily unavailable\n• Location has no GLDAS coverage`);
      setDataResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="nasa-data-fetch-test glass-card" style={{ padding: '2rem', margin: '2rem auto', maxWidth: '600px' }}>
      <h2 style={{ marginBottom: '1rem' }}>NASA Data Fetching Test</h2>
      <p style={{ marginBottom: '1.5rem', fontSize: '0.875rem', opacity: 0.8 }}>
        Fetch real satellite weather data from NASA GLDAS
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            Latitude (-90 to 90):
          </label>
          <input
            type="number"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            step="0.0001"
            min="-90"
            max="90"
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

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            Longitude (-180 to 180):
          </label>
          <input
            type="number"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            step="0.0001"
            min="-180"
            max="180"
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
      </div>

      <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', fontSize: '0.875rem' }}>
        <strong>📍 Example Locations:</strong>
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setLatitude('40.7128'); setLongitude('-74.0060'); }}
            style={{ padding: '0.25rem 0.75rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            New York
          </button>
          <button
            onClick={() => { setLatitude('51.5074'); setLongitude('-0.1278'); }}
            style={{ padding: '0.25rem 0.75rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            London
          </button>
          <button
            onClick={() => { setLatitude('-23.5505'); setLongitude('-46.6333'); }}
            style={{ padding: '0.25rem 0.75rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            São Paulo
          </button>
          <button
            onClick={() => { setLatitude('35.6762'); setLongitude('139.6503'); }}
            style={{ padding: '0.25rem 0.75rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            Tokyo
          </button>
        </div>
      </div>

      <button
        onClick={handleFetchData}
        disabled={isLoading || !nasaAuthService.isAuthenticated()}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: nasaAuthService.isAuthenticated() 
            ? 'linear-gradient(135deg, #10b981, #059669)' 
            : 'rgba(156, 163, 175, 0.3)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: isLoading || !nasaAuthService.isAuthenticated() ? 'not-allowed' : 'pointer',
          opacity: isLoading || !nasaAuthService.isAuthenticated() ? 0.6 : 1
        }}
      >
        {isLoading ? '⏳ Fetching NASA Data...' : '🛰️ Fetch Real NASA Weather Data'}
      </button>

      {!nasaAuthService.isAuthenticated() && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', fontSize: '0.875rem', color: '#ef4444' }}>
          ⚠️ Please authenticate with NASA first (see authentication section above)
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
            whiteSpace: 'pre-line',
            fontFamily: 'monospace'
          }}
        >
          {status}
        </div>
      )}

      {dataResults && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', border: '2px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '1rem', color: '#10b981' }}>📊 Data Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
            <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
              <div style={{ opacity: 0.7, marginBottom: '0.25rem' }}>Temperature Points</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{dataResults.temperature}</div>
            </div>
            <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
              <div style={{ opacity: 0.7, marginBottom: '0.25rem' }}>Precipitation Points</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{dataResults.precipitation}</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', fontSize: '0.875rem' }}>
        <strong>ℹ️ About NASA GLDAS Data:</strong>
        <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
          <li>Global Land Data Assimilation System</li>
          <li>0.25° spatial resolution (~25km)</li>
          <li>3-hourly temporal resolution</li>
          <li>Available from 2000-present</li>
          <li>Temperature in Kelvin (converted to Celsius)</li>
          <li>Precipitation in kg/m²/s (converted to mm/hour)</li>
        </ul>
      </div>
    </div>
  );
};
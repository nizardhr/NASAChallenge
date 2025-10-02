import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Satellite, Database } from 'lucide-react';
import { Coordinates } from '../types/weather';
import { nasaAuthService } from '../services/nasaAuth';
import { nasaDataFetcher } from '../services/nasaDataService';
import { CacheManager } from '../services/cacheManager';
import { ProbabilityCard } from './ProbabilityCard';
import { LocationPicker } from './LocationPicker';
import { DatePicker } from './DatePicker';
import { LoadingIndicator } from './LoadingIndicator';

const cacheManager = new CacheManager();

export const WeatherAnalyzer: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [analysis, setAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cacheManager.initialize().catch(console.error);
  }, []);

  const handleLocationSelect = useCallback((location: Coordinates) => {
    setSelectedLocation(location);
    setError(null);
  }, []);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setError(null);
  }, []);

  const performAnalysis = async () => {
    if (!selectedLocation || !selectedDate) return;

    if (!nasaAuthService.isAuthenticated()) {
      setError('⚠️ Please authenticate with NASA Earthdata first (scroll up to login)');
      return;
    }

    setIsLoading(true);
    setError(null);
    setLoadingProgress([]);
    setAnalysis(null);

    try {
      setLoadingProgress(prev => [...prev, '🔐 Authenticated with NASA']);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);

      setLoadingProgress(prev => [...prev, '🛰️ Fetching real NASA satellite data...']);
      setLoadingProgress(prev => [...prev, `📍 Location: ${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`]);
      setLoadingProgress(prev => [...prev, `📅 Date range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`]);

      const timeSeries = await nasaDataFetcher.fetchHistoricalWeatherData(
        selectedLocation,
        startDate,
        endDate
      );

      setLoadingProgress(prev => [...prev, '✅ NASA data retrieved successfully']);

      const quality = nasaDataFetcher.getDataQuality(timeSeries);

      setLoadingProgress(prev => [...prev, `📊 Temperature points: ${timeSeries.temperature.length}`]);
      setLoadingProgress(prev => [...prev, `💧 Precipitation points: ${timeSeries.precipitation.length}`]);
      setLoadingProgress(prev => [...prev, `📈 Data quality: ${quality.completeness}% complete`]);

      const avgTemp = timeSeries.temperature.length > 0
        ? timeSeries.temperature.reduce((sum, p) => sum + p.value, 0) / timeSeries.temperature.length
        : 0;

      const avgPrecip = timeSeries.precipitation.length > 0
        ? timeSeries.precipitation.reduce((sum, p) => sum + p.value, 0) / timeSeries.precipitation.length
        : 0;

      setAnalysis({
        location: selectedLocation,
        date: selectedDate,
        timeSeries: timeSeries,
        quality: quality,
        statistics: {
          avgTemperature: avgTemp,
          avgPrecipitation: avgPrecip,
          totalDataPoints: timeSeries.temperature.length + timeSeries.precipitation.length
        },
        sampleData: {
          temperature: timeSeries.temperature.slice(0, 5),
          precipitation: timeSeries.precipitation.slice(0, 5)
        }
      });

      setLoadingProgress(prev => [...prev, '✅ Analysis complete!']);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`❌ Data fetch failed: ${errorMessage}\n\nPossible issues:\n• Authentication expired (re-login above)\n• NASA servers temporarily unavailable\n• Location outside GLDAS coverage area`);
      console.error('Analysis error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLocation && selectedDate && nasaAuthService.isAuthenticated() && !isLoading) {
      performAnalysis();
    }
  }, [selectedLocation, selectedDate]);

  return (
    <div className="weather-analyzer">
      <motion.div
        className="analyzer-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1>Weather Probability Analysis</h1>
        <p style={{ fontSize: '0.875rem', opacity: 0.8, marginTop: '0.5rem' }}>
          Powered by NASA GLDAS satellite data
        </p>
      </motion.div>

      <div className="input-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <LocationPicker
            selectedLocation={selectedLocation}
            onLocationSelect={handleLocationSelect}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <DatePicker
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />
        </motion.div>
      </div>

      {!nasaAuthService.isAuthenticated() && (
        <div style={{
          padding: '1rem',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '2px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          marginBottom: '1rem',
          color: '#ef4444'
        }}>
          ⚠️ Please authenticate with NASA Earthdata above before selecting a location
        </div>
      )}

      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="loading-section glass-card"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ padding: '2rem', marginBottom: '2rem' }}
          >
            <h3 style={{ marginBottom: '1rem' }}>
              <Satellite className="inline" style={{ marginRight: '0.5rem' }} />
              Processing NASA Data
            </h3>
            <div style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
              {loadingProgress.map((msg, i) => (
                <div key={i} style={{ marginBottom: '0.5rem', opacity: 0.9 }}>
                  {msg}
                </div>
              ))}
              {isLoading && (
                <div style={{ marginTop: '1rem' }}>
                  <div className="spinner">⏳</div> Please wait...
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: '1.5rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '2px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            marginBottom: '2rem',
            whiteSpace: 'pre-line'
          }}
        >
          {error}
        </motion.div>
      )}

      <AnimatePresence>
        {analysis && !isLoading && (
          <motion.div
            className="analysis-results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="results-header glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
              <h2 style={{ marginBottom: '1rem' }}>
                <Database className="inline" style={{ marginRight: '0.5rem' }} />
                NASA Satellite Data Retrieved
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                <div className="stat-card clay-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: '#3b82f6' }}>
                    {analysis.statistics.totalDataPoints.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.7, marginTop: '0.5rem' }}>
                    Total Data Points
                  </div>
                </div>

                <div className="stat-card clay-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: '#10b981' }}>
                    {analysis.statistics.avgTemperature.toFixed(1)}°C
                  </div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.7, marginTop: '0.5rem' }}>
                    Average Temperature
                  </div>
                </div>

                <div className="stat-card clay-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: '#06b6d4' }}>
                    {analysis.statistics.avgPrecipitation.toFixed(2)} mm
                  </div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.7, marginTop: '0.5rem' }}>
                    Average Precipitation
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px' }}>
                <h4 style={{ marginBottom: '0.5rem', color: '#10b981' }}>✅ Real NASA GLDAS Data</h4>
                <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  Data range: {analysis.quality.dateRange.start.toLocaleDateString()} to {analysis.quality.dateRange.end.toLocaleDateString()}
                </p>
                <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  Quality: {analysis.quality.completeness}% complete • {analysis.quality.dataPoints} points analyzed
                </p>
              </div>

              <details style={{ marginTop: '1.5rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: '600', marginBottom: '1rem' }}>
                  📊 View Sample Data
                </summary>
                <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', background: 'rgba(0, 0, 0, 0.05)', padding: '1rem', borderRadius: '8px' }}>
                  <strong>Sample Temperature Values:</strong>
                  {analysis.sampleData.temperature.map((p: any, i: number) => (
                    <div key={i}>
                      {p.date.toLocaleDateString()}: {p.value.toFixed(2)}°C
                    </div>
                  ))}
                  <br />
                  <strong>Sample Precipitation Values:</strong>
                  {analysis.sampleData.precipitation.map((p: any, i: number) => (
                    <div key={i}>
                      {p.date.toLocaleDateString()}: {p.value.toFixed(2)} mm/hour
                    </div>
                  ))}
                </div>
              </details>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', fontSize: '0.875rem' }}>
              <strong>ℹ️ Next Step:</strong> This real NASA data will be used for probability calculations (coming soon)
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

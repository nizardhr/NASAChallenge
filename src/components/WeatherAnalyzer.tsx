import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Satellite, Database, Thermometer, Droplets, Wind, Sun, Cloud } from 'lucide-react';
import { Coordinates } from '../types/weather';
import { NASAAuthService } from '../services/nasaAuth';
import { NASADataFetcher } from '../services/nasaDataFetcher';
import { WeatherProbabilityCalculator, ProbabilityResults } from '../services/probabilityCalculator';
import { CacheManager } from '../services/cacheManager';
import { ProbabilityCard } from './ProbabilityCard';
import { LocationPicker } from './LocationPicker';
import { DatePicker } from './DatePicker';
import { LoadingIndicator } from './LoadingIndicator';

// Initialize NASA services
const authService = new NASAAuthService();
const dataFetcher = new NASADataFetcher(authService);
const probabilityCalculator = new WeatherProbabilityCalculator();
const cacheManager = new CacheManager();

export const WeatherAnalyzer: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [analysis, setAnalysis] = useState<ProbabilityResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Setup NASA authentication on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        await authService.authenticate({
          username: import.meta.env.VITE_NASA_USERNAME || 'demo_user',
          password: import.meta.env.VITE_NASA_PASSWORD || 'demo_pass'
        });
        console.log('✅ NASA authentication successful');
      } catch (err) {
        console.error('❌ NASA authentication failed:', err);
      }
    };
    initAuth();
  }, []);

  // Initialize cache manager
  useEffect(() => {
    cacheManager.initialize().catch(console.error);
  }, []);

  // Automatic analysis when location and date are selected
  useEffect(() => {
    if (selectedLocation && selectedDate && authService.isAuthenticated()) {
      performAnalysis();
    }
  }, [selectedLocation, selectedDate]);

  const handleLocationSelect = useCallback((location: Coordinates) => {
    setSelectedLocation(location);
  }, []);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const performAnalysis = async () => {
    if (!selectedLocation || !selectedDate) return;

    setIsLoading(true);
    setError(null);
    setLoadingProgress([]);

    try {
      // Setup progress tracking
      dataFetcher.onProgress((progress) => {
        setLoadingProgress(prev => {
          const filtered = prev.filter(p => p.source !== progress.source);
          return [...filtered, progress];
        });
      });

      // Fetch historical data from NASA
      const datasets = await dataFetcher.fetchHistoricalWeatherData(
        selectedLocation,
        selectedDate,
        20 // 20 years of historical data
      );

      if (datasets.length === 0) {
        throw new Error('No data retrieved from NASA services');
      }

      // Calculate probabilities using real NASA data
      const results = probabilityCalculator.calculateProbabilities(
        datasets,
        selectedDate
      );

      setAnalysis(results);
      
      // Cache the results
      await cacheManager.cacheData(
        selectedLocation,
        { start: new Date(selectedDate.getFullYear() - 20, 0, 1), end: new Date() },
        datasets[0]
      );
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      console.error('❌ Analysis error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getConditionIcon = (type: string) => {
    switch (type) {
      case 'veryHot': return Thermometer;
      case 'veryCold': return Thermometer;
      case 'veryWet': return Droplets;
      case 'veryWindy': return Wind;
      case 'veryUncomfortable': return Sun;
      default: return Cloud;
    }
  };

  const getConditionColor = (type: string) => {
    switch (type) {
      case 'veryHot': return '#ff6b6b';
      case 'veryCold': return '#42a5f5';
      case 'veryWet': return '#29b6f6';
      case 'veryWindy': return '#78909c';
      case 'veryUncomfortable': return '#ff7043';
      default: return '#6b7280';
    }
  };

  return (
    <div className="weather-analyzer">
      <div className="analyzer-header">
        <motion.h1 
          className="analyzer-title"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Will It Rain On My Parade?
        </motion.h1>
        <motion.p 
          className="analyzer-subtitle"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          NASA-powered weather probability analysis based on 20+ years of satellite data
        </motion.p>
      </div>

      <div className="control-grid">
        <div className="control-section">
          <div className="control-header">
            <MapPin className="control-icon" size={24} />
            <h3>Select Location</h3>
          </div>
          <LocationPicker
            selectedLocation={selectedLocation}
            onLocationSelect={handleLocationSelect}
          />
        </div>

        <div className="control-section">
          <div className="control-header">
            <Calendar className="control-icon" size={24} />
            <h3>Select Date</h3>
          </div>
          <DatePicker
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />
        </div>
      </div>

      {/* Loading indicator with NASA data fetching progress */}
      <AnimatePresence>
        {isLoading && (
          <LoadingIndicator 
            progress={loadingProgress}
            title="Fetching NASA Satellite Data"
          />
        )}
      </AnimatePresence>

      {/* Error display */}
      {error && (
        <motion.div 
          className="error-message glass-surface"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <p>❌ {error}</p>
          <motion.button 
            className="clay-button primary"
            onClick={performAnalysis}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Retry Analysis
          </motion.button>
        </motion.div>
      )}

      {/* Results display */}
      <AnimatePresence>
        {analysis && !isLoading && (
          <motion.div 
            className="analysis-results"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
          >
            <div className="results-header clay-surface">
              <h2>Weather Probability Analysis Results</h2>
              <div className="results-meta">
                <span>
                  <MapPin size={16} />
                  {selectedLocation?.lat.toFixed(4)}°, {selectedLocation?.lng.toFixed(4)}°
                </span>
                <span>
                  <Calendar size={16} />
                  {selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
                <span>
                  <Satellite size={16} />
                  {analysis.historicalContext.dataYears} years of NASA data
                </span>
                <span>
                  <Database size={16} />
                  {analysis.historicalContext.totalDataPoints} data points analyzed
                </span>
              </div>
            </div>

            <div className="probability-grid">
              {Object.entries(analysis.probabilities).map(([key, result]) => {
                const Icon = getConditionIcon(key);
                const color = getConditionColor(key);
                
                return (
                  <ProbabilityCard
                    key={key}
                    condition={{
                      type: key as any,
                      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                      probability: result.probability,
                      confidence: result.confidence,
                      threshold: result.threshold,
                      historicalOccurrences: result.historicalOccurrences
                    }}
                    icon={Icon}
                    color={color}
                  />
                );
              })}
            </div>

            {/* Data Quality and Historical Context */}
            <div className="quality-metrics clay-surface">
              <h3>Data Quality & Historical Context</h3>
              <div className="quality-grid">
                <div className="quality-metric">
                  <span className="metric-label">Data Completeness</span>
                  <div className="metric-bar">
                    <motion.div 
                      className="metric-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${analysis.dataQuality.completeness}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  </div>
                  <span className="metric-value">{Math.round(analysis.dataQuality.completeness)}%</span>
                </div>
                
                <div className="quality-metric">
                  <span className="metric-label">Data Reliability</span>
                  <div className="metric-bar">
                    <motion.div 
                      className="metric-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${analysis.dataQuality.reliability}%` }}
                      transition={{ duration: 1, delay: 0.7 }}
                    />
                  </div>
                  <span className="metric-value">{Math.round(analysis.dataQuality.reliability)}%</span>
                </div>
              </div>
              
              <div className="data-sources">
                <h4>NASA Data Sources</h4>
                <div className="sources-list">
                  {analysis.dataQuality.sources.map((source, index) => (
                    <span key={index} className="source-tag">
                      {source}
                    </span>
                  ))}
                </div>
              </div>

              <div className="historical-context">
                <h4>Historical Context</h4>
                <div className="context-grid">
                  <div className="context-item">
                    <Thermometer size={20} />
                    <span className="context-value">
                      {analysis.historicalContext.averageConditions.temperature.toFixed(1)}°C
                    </span>
                    <span className="context-label">Average Temperature</span>
                  </div>
                  <div className="context-item">
                    <Droplets size={20} />
                    <span className="context-value">
                      {analysis.historicalContext.averageConditions.precipitation.toFixed(1)}mm
                    </span>
                    <span className="context-label">Average Precipitation</span>
                  </div>
                  <div className="context-item">
                    <Wind size={20} />
                    <span className="context-value">
                      {analysis.historicalContext.averageConditions.windSpeed.toFixed(1)}m/s
                    </span>
                    <span className="context-label">Average Wind Speed</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
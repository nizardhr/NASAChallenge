import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Upload, BarChart3, Cloud, Sun, Wind, Droplets, Thermometer } from 'lucide-react';
import { Coordinates, WeatherAnalysis, LoadingProgress } from '../types/weather';
import { DataFormatRegistry } from '../services/dataProcessor';
import { WeatherProbabilityCalculator } from '../services/probabilityCalculator';
import { CacheManager } from '../services/cacheManager';
import { ProbabilityCard } from './ProbabilityCard';
import { LocationPicker } from './LocationPicker';
import { DatePicker } from './DatePicker';
import { FileUploader } from './FileUploader';
import { LoadingIndicator } from './LoadingIndicator';
import { ProbabilityChart } from './ProbabilityChart';

const dataProcessor = new DataFormatRegistry();
const probabilityCalculator = new WeatherProbabilityCalculator();
const cacheManager = new CacheManager();

export const WeatherAnalyzer: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [analysis, setAnalysis] = useState<WeatherAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleLocationSelect = useCallback((location: Coordinates) => {
    setSelectedLocation(location);
  }, []);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleFileUpload = useCallback(async (files: File[]) => {
    setUploadedFiles(files);
    setLoadingProgress([]);
    setIsLoading(true);

    try {
      const datasets = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        setLoadingProgress(prev => [
          ...prev.filter(p => p.source !== file.name),
          {
            source: file.name,
            status: 'loading',
            progress: 0,
            overallProgress: (i / files.length) * 100
          }
        ]);

        const dataset = await dataProcessor.processFile(file);
        datasets.push(dataset);

        setLoadingProgress(prev => 
          prev.map(p => 
            p.source === file.name 
              ? { ...p, status: 'complete', progress: 100 }
              : p
          )
        );
      }

      if (selectedLocation && datasets.length > 0) {
        await performAnalysis(datasets);
      }
    } catch (error) {
      console.error('Error processing files:', error);
      setLoadingProgress(prev => 
        prev.map(p => ({ ...p, status: 'error' }))
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedLocation]);

  const performAnalysis = useCallback(async (datasets: any[]) => {
    if (!selectedLocation) return;

    try {
      setIsLoading(true);
      
      // Check cache first
      const cacheKey = `${selectedLocation.lat}-${selectedLocation.lng}-${selectedDate.toISOString()}`;
      
      // Simulate analysis delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const results = probabilityCalculator.calculateExtremeEventProbabilities(
        datasets,
        selectedDate,
        selectedLocation
      );

      const newAnalysis: WeatherAnalysis = {
        location: selectedLocation,
        targetDate: selectedDate,
        results,
        generatedAt: new Date()
      };

      setAnalysis(newAnalysis);
      
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedLocation, selectedDate]);

  const getConditionIcon = (type: string) => {
    switch (type) {
      case 'veryHot': return Sun;
      case 'veryCold': return Thermometer;
      case 'veryWet': return Droplets;
      case 'veryWindy': return Wind;
      case 'veryUncomfortable': return Cloud;
      default: return BarChart3;
    }
  };

  const getConditionColor = (type: string) => {
    switch (type) {
      case 'veryHot': return 'var(--weather-hot)';
      case 'veryCold': return 'var(--weather-cold)';
      case 'veryWet': return 'var(--weather-wet)';
      case 'veryWindy': return 'var(--weather-windy)';
      case 'veryUncomfortable': return 'var(--weather-uncomfortable)';
      default: return 'var(--clay-bg-primary)';
    }
  };

  return (
    <div className="weather-analyzer">
      {/* Header Section */}
      <motion.div 
        className="analyzer-header clay-surface"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="header-content">
          <h1 className="analyzer-title">
            NASA Weather Probability Platform
          </h1>
          <p className="analyzer-subtitle">
            Advanced probability analysis for extreme weather events
          </p>
        </div>
      </motion.div>

      {/* Input Controls */}
      <div className="control-grid">
        <motion.div
          className="control-section glass-surface"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="control-header">
            <MapPin className="control-icon" />
            <h3>Select Location</h3>
          </div>
          <LocationPicker 
            onLocationSelect={handleLocationSelect}
            selectedLocation={selectedLocation}
          />
        </motion.div>

        <motion.div
          className="control-section glass-surface"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="control-header">
            <Calendar className="control-icon" />
            <h3>Select Date</h3>
          </div>
          <DatePicker
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />
        </motion.div>

        <motion.div
          className="control-section glass-surface"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="control-header">
            <Upload className="control-icon" />
            <h3>Upload Data</h3>
          </div>
          <FileUploader
            onFileUpload={handleFileUpload}
            acceptedFormats={['.nc', '.grib', '.grib2', '.hdf', '.csv', '.json']}
            maxFiles={5}
          />
        </motion.div>
      </div>

      {/* Loading Indicator */}
      <AnimatePresence>
        {isLoading && (
          <LoadingIndicator 
            progress={loadingProgress}
            title="Processing Weather Data"
          />
        )}
      </AnimatePresence>

      {/* Analysis Results */}
      <AnimatePresence>
        {analysis && !isLoading && (
          <motion.div
            className="analysis-results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* Results Header */}
            <div className="results-header clay-surface">
              <h2>Probability Analysis Results</h2>
              <div className="results-meta">
                <span>Location: {analysis.location.lat.toFixed(4)}°, {analysis.location.lng.toFixed(4)}°</span>
                <span>Date: {analysis.targetDate.toLocaleDateString()}</span>
                <span>Generated: {analysis.generatedAt.toLocaleString()}</span>
              </div>
            </div>

            {/* Probability Cards Grid */}
            <div className="probability-grid">
              {analysis.results.conditions.map((condition, index) => {
                const Icon = getConditionIcon(condition.type);
                return (
                  <motion.div
                    key={condition.type}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <ProbabilityCard
                      condition={condition}
                      icon={Icon}
                      color={getConditionColor(condition.type)}
                    />
                  </motion.div>
                );
              })}
            </div>

            {/* Historical Context Chart */}
            <motion.div
              className="chart-section clay-surface"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <h3>Historical Context</h3>
              <ProbabilityChart 
                data={analysis.results.historicalContext}
                confidenceIntervals={analysis.results.confidenceIntervals}
              />
            </motion.div>

            {/* Data Quality Metrics */}
            <motion.div
              className="quality-metrics glass-surface"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <h3>Data Quality Assessment</h3>
              <div className="quality-grid">
                <div className="quality-metric">
                  <span className="metric-label">Completeness</span>
                  <div className="metric-bar">
                    <motion.div 
                      className="metric-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${analysis.results.dataQuality.completeness}%` }}
                      transition={{ delay: 0.8, duration: 1 }}
                    />
                  </div>
                  <span className="metric-value">{analysis.results.dataQuality.completeness}%</span>
                </div>
                
                <div className="quality-metric">
                  <span className="metric-label">Reliability</span>
                  <div className="metric-bar">
                    <motion.div 
                      className="metric-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${analysis.results.dataQuality.reliability}%` }}
                      transition={{ delay: 0.9, duration: 1 }}
                    />
                  </div>
                  <span className="metric-value">{analysis.results.dataQuality.reliability}%</span>
                </div>
              </div>
              
              <div className="data-sources">
                <h4>Data Sources</h4>
                <div className="sources-list">
                  {analysis.results.dataQuality.sources.map((source, index) => (
                    <motion.span
                      key={source}
                      className="source-tag"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1 + index * 0.1 }}
                    >
                      {source}
                    </motion.span>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
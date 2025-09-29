import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, BarChart3, Cloud, Sun, Wind, Droplets, Thermometer, Satellite, Database, Shield } from 'lucide-react';
import { Coordinates, WeatherAnalysis, LoadingProgress } from '../types/weather';
import { WeatherProbabilityCalculator } from '../services/probabilityCalculator';
import { NASADataIntegrator } from '../services/nasaDataService';
import { ProbabilityCard } from './ProbabilityCard';
import { LocationPicker } from './LocationPicker';
import { DatePicker } from './DatePicker';
import { LoadingIndicator } from './LoadingIndicator';
import { ProbabilityChart } from './ProbabilityChart';

const probabilityCalculator = new WeatherProbabilityCalculator();
const nasaDataIntegrator = new NASADataIntegrator();

export const WeatherAnalyzer: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [analysis, setAnalysis] = useState<WeatherAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress[]>([]);

  const handleLocationSelect = useCallback((location: Coordinates) => {
    setSelectedLocation(location);
    // Auto-trigger analysis when both location and date are available
    if (location && selectedDate) {
      performAnalysis(location, selectedDate);
    }
  }, []);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    // Auto-trigger analysis when both location and date are available
    if (selectedLocation && date) {
      performAnalysis(selectedLocation, date);
    }
  }, []);

  const performAnalysis = useCallback(async (location: Coordinates, date: Date) => {
    setLoadingProgress([]);
    setIsLoading(true);
    setAnalysis(null);

    try {
      // Step 1: NASA Authentication
      setLoadingProgress([{
        source: 'NASA Authentication',
        status: 'loading',
        progress: 0
      }]);
      
      await nasaDataIntegrator.authenticate();
      
      setLoadingProgress(prev => 
        prev.map(p => p.source === 'NASA Authentication' 
          ? { ...p, status: 'complete', progress: 100 }
          : p
        )
      );

      // Step 2: Fetch Historical Data
      setLoadingProgress(prev => [
        ...prev,
        {
          source: 'Historical Data Retrieval',
          status: 'loading',
          progress: 0
        }
      ]);
      
      const historicalData = await nasaDataIntegrator.fetchHistoricalWeatherData(
        location,
        date,
        25 // 25 years of data
      );
      
      setLoadingProgress(prev => 
        prev.map(p => p.source === 'Historical Data Retrieval' 
          ? { ...p, status: 'complete', progress: 100 }
          : p
        )
      );

      // Step 3: Statistical Analysis
      setLoadingProgress(prev => [
        ...prev,
        {
          source: 'Statistical Analysis',
          status: 'loading',
          progress: 0
        }
      ]);
      
      const results = probabilityCalculator.calculateProbabilities(
        historicalData,
        date,
        location
      );
      
      setLoadingProgress(prev => 
        prev.map(p => p.source === 'Statistical Analysis' 
          ? { ...p, status: 'complete', progress: 100 }
          : p
        )
      );
      
      const newAnalysis: WeatherAnalysis = {
        location,
        targetDate: date,
        results,
        generatedAt: new Date()
      };

      setAnalysis(newAnalysis);
      
    } catch (error) {
      console.error('Analysis error:', error);
      setLoadingProgress(prev => 
        prev.map(p => ({ ...p, status: 'error' }))
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

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
        animate={{ opacity: 1, y: 
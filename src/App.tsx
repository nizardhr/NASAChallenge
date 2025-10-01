import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { WeatherAnalyzer } from './components/WeatherAnalyzer';
import { NASAAuthTest } from './components/NASAAuthTest';
import { NASADataFetchTest } from './components/NASADataFetchTest';
import { CacheManager } from './services/cacheManager';

// Initialize cache manager
const cacheManager = new CacheManager();

function App() {
  useEffect(() => {
    // Initialize cache when app loads
    cacheManager.initialize().catch(console.error);
  }, []);

  return (
    <div className="app">
      <div className="app-background">
        <div className="gradient-orb gradient-orb-1"></div>
        <div className="gradient-orb gradient-orb-2"></div>
        <div className="gradient-orb gradient-orb-3"></div>
      </div>
      
      <motion.main
        className="main-content"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <NASAAuthTest />
        <NASADataFetchTest />
        <WeatherAnalyzer />
      </motion.main>
    </div>
  );
}

export default App;
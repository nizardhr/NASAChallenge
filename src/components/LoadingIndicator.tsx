import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, AlertCircle, Database } from 'lucide-react';
import { LoadingProgress } from '../types/weather';

interface LoadingIndicatorProps {
  progress: LoadingProgress[];
  title: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  progress,
  title
}) => {
  const overallProgress = progress.length > 0 
    ? progress.reduce((sum, p) => sum + p.progress, 0) / progress.length
    : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'loading':
        return <Loader2 className="animate-spin" size={16} />;
      case 'complete':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={16} />;
      default:
        return <Database size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'loading':
        return 'var(--weather-wet)';
      case 'complete':
        return 'var(--weather-success, #10b981)';
      case 'error':
        return 'var(--weather-error, #ef4444)';
      default:
        return 'var(--clay-bg-secondary)';
    }
  };

  return (
    <motion.div
      className="loading-indicator glass-surface"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="loading-header">
        <div className="loading-icon clay-surface">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Database size={24} />
          </motion.div>
        </div>
        
        <div className="loading-info">
          <h3 className="loading-title">{title}</h3>
          <p className="loading-subtitle">
            Analyzing weather data from multiple sources...
          </p>
        </div>
      </div>

      <div className="overall-progress">
        <div className="progress-label">
          <span>Overall Progress</span>
          <span>{Math.round(overallProgress)}%</span>
        </div>
        <div className="progress-bar clay-inset">
          <motion.div
            className="progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <div className="sources-progress">
        {progress.map((item, index) => (
          <motion.div
            key={item.source}
            className="source-item"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="source-header">
              <div className="source-status">
                {getStatusIcon(item.status)}
              </div>
              <div className="source-info">
                <span className="source-name">{item.source}</span>
                <span className="source-status-text">
                  {item.status === 'loading' && 'Processing...'}
                  {item.status === 'complete' && 'Complete'}
                  {item.status === 'error' && 'Error'}
                </span>
              </div>
              <span className="source-progress-text">
                {item.progress}%
              </span>
            </div>
            
            <div className="source-progress-bar clay-inset">
              <motion.div
                className="source-progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${item.progress}%` }}
                style={{ backgroundColor: getStatusColor(item.status) }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="loading-tips">
        <h4>Processing Details:</h4>
        <ul>
          <li>🌡️ Extracting temperature time series</li>
          <li>🌧️ Analyzing precipitation patterns</li>
          <li>💨 Processing wind speed data</li>
          <li>📊 Calculating statistical thresholds</li>
          <li>🎯 Computing probability distributions</li>
        </ul>
      </div>
    </motion.div>
  );
};
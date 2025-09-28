import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Info, TrendingUp } from 'lucide-react';
import { WeatherCondition } from '../types/weather';

interface ProbabilityCardProps {
  condition: WeatherCondition;
  icon: React.ComponentType<any>;
  color: string;
}

export const ProbabilityCard: React.FC<ProbabilityCardProps> = ({
  condition,
  icon: Icon,
  color
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const getProbabilityLevel = (probability: number) => {
    if (probability >= 70) return 'high';
    if (probability >= 40) return 'medium';
    return 'low';
  };

  const level = getProbabilityLevel(condition.probability);

  return (
    <motion.div 
      className={`probability-card clay-card ${level}`}
      whileHover={{ 
        scale: 1.02,
        boxShadow: '8px 8px 16px rgba(0,0,0,0.15), -8px -8px 16px rgba(255,255,255,0.7)'
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div className="card-header">
        <div className="condition-icon" style={{ background: color }}>
          <Icon size={24} />
        </div>
        <div className="condition-info">
          <h3 className="condition-label">{condition.label}</h3>
          <span className="condition-type">{condition.type.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
        </div>
      </div>

      <div className="probability-display">
        <motion.div 
          className="probability-circle"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 200, 
            damping: 15,
            delay: 0.2
          }}
        >
          <svg viewBox="0 0 100 100" className="probability-ring">
            <circle
              cx="50"
              cy="50"
              r="40"
              className="ring-background"
              fill="none"
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="8"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              className="ring-progress"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 40}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
              animate={{ 
                strokeDashoffset: 2 * Math.PI * 40 * (1 - condition.probability / 100)
              }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: 'center'
              }}
            />
          </svg>
          <div className="probability-text">
            <motion.span 
              className="probability-value"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              {condition.probability}%
            </motion.span>
          </div>
        </motion.div>
      </div>

      <div className="card-metrics">
        <div className="metric">
          <TrendingUp size={16} />
          <span>Confidence: {condition.confidence}%</span>
        </div>
        <div className="metric">
          <span>Historical: {condition.historicalOccurrences} events</span>
        </div>
      </div>

      <motion.button
        className="details-button glass-button"
        onClick={() => setShowDetails(!showDetails)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Info size={16} />
        {showDetails ? 'Hide Details' : 'Show Details'}
      </motion.button>

      {showDetails && (
        <motion.div
          className="card-details"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <div className="detail-row">
            <span className="detail-label">Threshold:</span>
            <span className="detail-value">{condition.threshold.toFixed(2)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Historical Events:</span>
            <span className="detail-value">{condition.historicalOccurrences}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Confidence Level:</span>
            <span className="detail-value">{condition.confidence}%</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
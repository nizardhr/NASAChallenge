import React from 'react';
import { motion } from 'framer-motion';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ReferenceLine 
} from 'recharts';

interface ProbabilityChartProps {
  data: {
    years: number[];
    values: number[];
  };
  confidenceIntervals: Array<{
    lower: number;
    upper: number;
  }>;
}

export const ProbabilityChart: React.FC<ProbabilityChartProps> = ({
  data,
  confidenceIntervals
}) => {
  // Transform data for recharts
  const chartData = data.years.map((year, index) => ({
    year,
    value: data.values[index],
    confidenceUpper: confidenceIntervals[0]?.upper || 0,
    confidenceLower: confidenceIntervals[0]?.lower || 0
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip glass-surface">
          <p className="tooltip-label">{`Year: ${label}`}</p>
          <p className="tooltip-value">
            <span style={{ color: payload[0].color }}>
              Weather Index: {payload[0].value}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      className="probability-chart"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="chart-header">
        <h4>Historical Weather Pattern Analysis</h4>
        <p>Composite weather index showing patterns over time</p>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--weather-primary, #3b82f6)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="var(--weather-primary, #3b82f6)" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgba(59, 130, 246, 0.3)" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="rgba(59, 130, 246, 0.3)" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            
            <XAxis 
              dataKey="year" 
              stroke="rgba(255,255,255,0.7)"
              fontSize={12}
            />
            <YAxis 
              stroke="rgba(255,255,255,0.7)"
              fontSize={12}
            />
            
            {/* Confidence Interval Band */}
            <Area
              dataKey="confidenceUpper"
              stackId="confidence"
              stroke="none"
              fill="url(#confidenceGradient)"
              fillOpacity={0.3}
            />
            <Area
              dataKey="confidenceLower"
              stackId="confidence"
              stroke="none"
              fill="url(#confidenceGradient)"
              fillOpacity={0.3}
            />
            
            {/* Main Data Line */}
            <Area
              dataKey="value"
              stroke="var(--weather-primary, #3b82f6)"
              strokeWidth={2}
              fill="url(#valueGradient)"
              dot={{ fill: 'var(--weather-primary, #3b82f6)', r: 3 }}
              activeDot={{ r: 5, fill: 'var(--weather-accent, #f97316)' }}
            />
            
            {/* Current Year Reference Line */}
            <ReferenceLine 
              x={new Date().getFullYear()}
              stroke="var(--weather-accent, #f97316)"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ value: "Current Year", position: "top" }}
            />
            
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-legend">
        <div className="legend-item">
          <div 
            className="legend-color" 
            style={{ backgroundColor: 'var(--weather-primary, #3b82f6)' }}
          />
          <span>Historical Weather Index</span>
        </div>
        <div className="legend-item">
          <div 
            className="legend-color confidence" 
            style={{ backgroundColor: 'rgba(59, 130, 246, 0.3)' }}
          />
          <span>Confidence Interval (95%)</span>
        </div>
        <div className="legend-item">
          <div 
            className="legend-color reference" 
            style={{ backgroundColor: 'var(--weather-accent, #f97316)' }}
          />
          <span>Current Year</span>
        </div>
      </div>
    </motion.div>
  );
};
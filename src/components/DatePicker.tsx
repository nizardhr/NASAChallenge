import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  selectedDate,
  onDateSelect
}) => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const adjustDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    onDateSelect(newDate);
  };

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(event.target.value);
    if (!isNaN(newDate.getTime())) {
      onDateSelect(newDate);
    }
  };

  return (
    <div className="date-picker">
      <div className="date-display clay-surface">
        <Calendar className="date-icon" size={24} />
        <div className="date-info">
          <span className="date-label">Target Date</span>
          <span className="date-value">{formatDate(selectedDate)}</span>
        </div>
      </div>

      <div className="date-controls">
        <motion.button
          className="date-nav-button clay-button"
          onClick={() => adjustDate(-1)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Previous day"
        >
          <ChevronLeft size={20} />
        </motion.button>

        <div className="date-input-container clay-inset">
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={handleDateChange}
            className="date-input"
          />
        </div>

        <motion.button
          className="date-nav-button clay-button"
          onClick={() => adjustDate(1)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Next day"
        >
          <ChevronRight size={20} />
        </motion.button>
      </div>

      <div className="quick-dates">
        <span className="quick-dates-label">Quick Select:</span>
        <div className="quick-dates-grid">
          {[-7, -1, 0, 1, 7, 30].map(days => {
            const date = new Date();
            date.setDate(date.getDate() + days);
            
            let label = '';
            if (days === 0) label = 'Today';
            else if (days === 1) label = 'Tomorrow';
            else if (days === -1) label = 'Yesterday';
            else if (days === 7) label = 'Next Week';
            else if (days === -7) label = 'Last Week';
            else if (days === 30) label = 'Next Month';
            
            return (
              <motion.button
                key={days}
                className="quick-date-button glass-button"
                onClick={() => onDateSelect(date)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {label}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
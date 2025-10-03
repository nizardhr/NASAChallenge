import React, { useState } from 'react';

export interface FormData {
  latitude: number;
  longitude: number;
  startDate: Date;
  endDate: Date;
  username: string;
  password: string;
}

interface InputFormProps {
  onSubmit: (data: FormData) => void;
  loading?: boolean;
}

export function InputForm({ onSubmit, loading = false }: InputFormProps) {
  const [latitude, setLatitude] = useState('40.0');
  const [longitude, setLongitude] = useState('-100.0');
  const [startDate, setStartDate] = useState('2023-07-04');
  const [endDate, setEndDate] = useState('2023-07-06');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setError('Latitude must be between -90 and 90');
      return;
    }

    if (isNaN(lon) || lon < -180 || lon > 180) {
      setError('Longitude must be between -180 and 180');
      return;
    }

    if (!username || !password) {
      setError('NASA Earthdata credentials are required');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      setError('End date must be after start date');
      return;
    }

    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
      setError('Date range cannot exceed 30 days to ensure reasonable processing time');
      return;
    }

    onSubmit({
      latitude: lat,
      longitude: lon,
      startDate: start,
      endDate: end,
      username,
      password
    });
  };

  return (
    <div className="input-form">
      {/* Card Header */}
      <div className="card-header">
        <h2>⚙️ Configure Data Extraction</h2>
      </div>

      {/* Card Body */}
      <div className="card-body">
        {error && (
          <div className="error">
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            {/* Location Section */}
            <div className="form-group">
              <label>📍 Latitude</label>
              <input
                type="number"
                step="0.0001"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g., 40.0"
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>📍 Longitude</label>
              <input
                type="number"
                step="0.0001"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g., -100.0"
                disabled={loading}
                required
              />
            </div>

            {/* Date Range Section */}
            <div className="form-group">
              <label>📅 Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min="2000-01-01"
                max={new Date().toISOString().split('T')[0]}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>📅 End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                max={new Date().toISOString().split('T')[0]}
                disabled={loading}
                required
              />
            </div>

            {/* NASA Credentials Section */}
            <div className="form-group">
              <label>👤 NASA Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your Earthdata username"
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>🔒 NASA Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your Earthdata password"
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '⏳ Fetching Data...' : '🚀 Extract Weather Data'}
          </button>

          {/* Help Text */}
          <div className="help-text">
            <p>
              📚 Need NASA Earthdata credentials? <a href="https://urs.earthdata.nasa.gov" target="_blank" rel="noopener noreferrer">Register for free</a>
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              ⚠️ After registering, approve the <strong>GES DISC DATA ARCHIVE</strong> application in your Earthdata profile
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
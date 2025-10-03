import React, { useState } from 'react';

interface InputFormProps {
  onSubmit: (data: FormData) => void;
}

export interface FormData {
  latitude: number;
  longitude: number;
  startDate: Date;
  endDate: Date;
  username: string;
  password: string;
}

export function InputForm({ onSubmit }: InputFormProps) {
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

    // Validate
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
      setError('NASA Earthdata credentials required');
      return;
    }

    onSubmit({
      latitude: lat,
      longitude: lon,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      username,
      password
    });
  };

  return (
    <form onSubmit={handleSubmit} className="input-form">
      <h2>GLDAS Weather Data Extractor</h2>
      
      {error && <div className="error">{error}</div>}

      <div className="form-group">
        <label>Latitude (-90 to 90):</label>
        <input
          type="number"
          step="0.01"
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Longitude (-180 to 180):</label>
        <input
          type="number"
          step="0.01"
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Start Date:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          min="2000-01-01"
          max={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div className="form-group">
        <label>End Date:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          min={startDate}
          max={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div className="form-group">
        <label>NASA Username:</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Earthdata username"
        />
      </div>

      <div className="form-group">
        <label>NASA Password:</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Earthdata password"
        />
      </div>

      <button type="submit">Fetch Data</button>
      
      <p className="help-text">
        Need credentials? <a href="https://urs.earthdata.nasa.gov" target="_blank">Sign up at NASA Earthdata</a>
      </p>
    </form>
  );
}
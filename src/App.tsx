import React, { useState } from 'react';
import { InputForm, FormData } from './components/InputForm';
import { getUrlsForDateRange } from './utils/dateHelpers';
import { parseASCIIData, WeatherDataPoint } from './utils/asciiParser';
import { generateCSV } from './utils/csvGenerator';
import './index.css';

function App() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [data, setData] = useState<WeatherDataPoint[]>([]);
  const [error, setError] = useState('');

  const handleFetchData = async (formData: FormData) => {
    setLoading(true);
    setError('');
    setData([]);

    try {
      const urls = getUrlsForDateRange(formData.startDate, formData.endDate);
      setProgress(`Found ${urls.length} files to download...`);

      const allData: WeatherDataPoint[] = [];

      for (let i = 0; i < urls.length; i++) {
        setProgress(`Downloading file ${i + 1} of ${urls.length}...`);

        const response = await fetch('/api/download-gldas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: urls[i]
            // No credentials needed - server uses token
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || result.error || 'Download failed');
        }

        setProgress(`Processing file ${i + 1} of ${urls.length}...`);
        
        const fileData = parseASCIIData(
          result.data,
          formData.latitude,
          formData.longitude
        );

        allData.push(...fileData);

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      allData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      setData(allData);
      setProgress('');

    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'An error occurred while fetching data');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    const csv = generateCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gldas_weather_data_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <div className="app-header">
        <h1>🛰️ NASA GLDAS Data Extractor</h1>
        <p>Extract historical weather data from NASA's Global Land Data Assimilation System</p>
      </div>

      <InputForm onSubmit={handleFetchData} loading={loading} />

      {loading && (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>{progress}</p>
        </div>
      )}

      {error && (
        <div className="error">
          <p>{error}</p>
        </div>
      )}

      {data.length > 0 && (
        <div className="results">
          <h3>📊 Extracted Weather Data</h3>
          <p className="results-count">Total: {data.length} data points</p>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>Temperature (°C)</th>
                  <th>Precipitation (mm/hr)</th>
                  <th>Humidity (%)</th>
                  <th>Wind Speed (m/s)</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 20).map((point, i) => (
                  <tr key={i}>
                    <td>{point.timestamp.toLocaleString()}</td>
                    <td>{point.temperature.toFixed(1)}</td>
                    <td>{point.precipitation.toFixed(2)}</td>
                    <td>{point.humidity.toFixed(1)}</td>
                    <td>{point.windSpeed.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.length > 20 && (
            <p className="results-count">Showing first 20 of {data.length} records</p>
          )}

          <button className="download-btn" onClick={handleDownloadCSV}>
            📥 Download Complete CSV ({data.length} records)
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
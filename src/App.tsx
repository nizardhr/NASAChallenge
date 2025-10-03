import React, { useState } from 'react';
import { InputForm, FormData } from './components/InputForm';
import { getUrlsForDateRange } from './utils/dateHelpers';
import { parseNetCDFFile, WeatherDataPoint } from './utils/netcdfParser';
import { generateCSV } from './utils/csvGenerator';

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
      // Step 1: Get list of URLs
      const urls = getUrlsForDateRange(formData.startDate, formData.endDate);
      setProgress(`Found ${urls.length} files to download...`);

      const allData: WeatherDataPoint[] = [];

      // Step 2: Download and process each file
      for (let i = 0; i < urls.length; i++) {
        setProgress(`Downloading file ${i + 1} of ${urls.length}...`);

        // Download through proxy
        const response = await fetch('http://localhost:3001/api/download-gldas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: urls[i],
            username: formData.username,
            password: formData.password
          })
        });

        if (!response.ok) {
          throw new Error(`Download failed: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Download failed');
        }

        // Step 3: Parse NetCDF file
        setProgress(`Processing file ${i + 1} of ${urls.length}...`);
        
        const fileData = parseNetCDFFile(
          result.data,
          formData.latitude,
          formData.longitude
        );

        allData.push(...fileData);

        // Small delay to avoid overwhelming server
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Step 4: Sort by timestamp
      allData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      setData(allData);
      setProgress(`Complete! Extracted ${allData.length} data points.`);

    } catch (err: any) {
      setError(err.message);
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
    a.download = `gldas_data_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <InputForm onSubmit={handleFetchData} />

      {loading && <div className="loading">{progress}</div>}
      {error && <div className="error">{error}</div>}

      {data.length > 0 && (
        <div className="results">
          <h3>Results ({data.length} records)</h3>
          
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
              {data.slice(0, 10).map((point, i) => (
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

          {data.length > 10 && (
            <p>Showing first 10 of {data.length} records</p>
          )}

          <button onClick={handleDownloadCSV}>Download Complete CSV</button>
        </div>
      )}
    </div>
  );
}

export default App;
import React, { useState } from 'react';
import { InputForm, FormData } from './components/InputForm';
import { getUrlsForDateRange } from './utils/dateHelpers';
import { parseASCIIData, WeatherDataPoint } from './utils/asciiParser';
import { generateCSV, getDatasetSummary } from './utils/csvGenerator';
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
      // Generate optimized URLs with spatial subsetting
      const urls = getUrlsForDateRange(
        formData.startDate, 
        formData.endDate,
        formData.latitude,
        formData.longitude
      );
      
      // Warning for large date ranges
      if (urls.length > 80) {
        const days = Math.ceil(urls.length / 8);
        console.warn(`⚠️ Large date range: ${urls.length} files (~${days} days)`);
        console.warn('   Estimated time: ' + (urls.length * 2) + '-' + (urls.length * 5) + ' seconds with optimization');
      }
      
      setProgress(`Found ${urls.length} files to download (optimized for ${formData.latitude}°, ${formData.longitude}°)...`);

      const allData: WeatherDataPoint[] = [];
      let successCount = 0;
      let failCount = 0;

      // Download and process each file
      for (let i = 0; i < urls.length; i++) {
        const fileNum = i + 1;
        const progressPercent = Math.round((fileNum / urls.length) * 100);
        setProgress(`[${progressPercent}%] Downloading file ${fileNum} of ${urls.length}...`);

        try {
          const response = await fetch('/api/download-gldas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: urls[i]
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            
            // Handle specific errors differently
            if (response.status === 504) {
              // Timeout - provide helpful message
              throw new Error(
                `File ${fileNum}: Timeout (NASA server slow). ` +
                (errorData.suggestion || 'Try a smaller date range.')
              );
            }
            
            throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
          }

          const result = await response.json();

          if (!result.success) {
            throw new Error(result.message || result.error || 'Download failed');
          }

          setProgress(`[${progressPercent}%] Processing file ${fileNum} of ${urls.length}...`);
          
          // Parse the file and add to accumulated data
          const fileData = parseASCIIData(
            result.data,
            formData.latitude,
            formData.longitude
          );

          allData.push(...fileData);
          successCount++;

          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (fileError: any) {
          failCount++;
          console.error(`❌ Failed to process file ${fileNum}:`, fileError.message);
          
          // If we have enough successful downloads, continue
          if (successCount > 0 && successCount >= urls.length * 0.5) {
            console.log(`⚠️ Continuing with ${successCount} successful files...`);
            continue;
          }
          
          // Otherwise, throw error to stop processing
          throw fileError;
        }
      }

      // Sort all data by timestamp
      allData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      console.log('\n✅ ========================================');
      console.log('   DOWNLOAD COMPLETE');
      console.log('========================================');
      console.log(`   Successfully processed: ${successCount}/${urls.length} files`);
      if (failCount > 0) {
        console.log(`   Failed: ${failCount} files`);
      }
      
      // Log dataset summary
      const summary = getDatasetSummary(allData);
      console.log('📊 Dataset Summary:');
      console.log(`   Total Data Points: ${summary.totalPoints}`);
      console.log(`   Variables: ${summary.variables.join(", ")}`);
      console.log(`   Date Range: ${summary.dateRange?.start} to ${summary.dateRange?.end}`);
      console.log(`   Spatial Extent: Lat [${summary.spatialExtent?.minLat?.toFixed(2)}, ${summary.spatialExtent?.maxLat?.toFixed(2)}], Lon [${summary.spatialExtent?.minLon?.toFixed(2)}, ${summary.spatialExtent?.maxLon?.toFixed(2)}]`);
      console.log('========================================\n');

      if (allData.length === 0) {
        throw new Error('No data was successfully downloaded. Please try again with a different date range.');
      }

      setData(allData);
      setProgress('');

      // Show warning if some files failed
      if (failCount > 0 && successCount > 0) {
        setError(`⚠️ Warning: ${failCount} of ${urls.length} files failed to download. Showing data from ${successCount} successful files.`);
      }

    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'An error occurred while fetching data');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Download consolidated CSV with all data from all files.
   * This is the ONLY place where CSV download happens.
   */
  const handleDownloadCSV = () => {
    console.log('📥 Starting CSV download...');
    
    // Generate CSV from all accumulated data
    const csv = generateCSV(data); // Using human-readable version with unit conversions
    
    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Generate filename with timestamp and date range
    const firstDate = data[0]?.timestamp;
    const lastDate = data[data.length - 1]?.timestamp;
    const dateStr = firstDate && lastDate 
      ? `${firstDate.toISOString().split('T')[0]}_to_${lastDate.toISOString().split('T')[0]}`
      : Date.now();
    
    const filename = `nasa_gldas_consolidated_${dateStr}.csv`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`✅ CSV downloaded: ${filename}`);
    console.log(`   Contains ${data.length} data points from all processed files`);
  };

  /**
   * Alternative download with raw variable names (no conversions).
   */
  const handleDownloadRawCSV = () => {
    console.log('📥 Starting raw CSV download...');
    
    const csv = generateCSV(data); // Raw version with original variable names
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const firstDate = data[0]?.timestamp;
    const lastDate = data[data.length - 1]?.timestamp;
    const dateStr = firstDate && lastDate 
      ? `${firstDate.toISOString().split('T')[0]}_to_${lastDate.toISOString().split('T')[0]}`
      : Date.now();
    
    const filename = `nasa_gldas_raw_${dateStr}.csv`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`✅ Raw CSV downloaded: ${filename}`);
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
          <p className="results-count">
            Total: {data.length} data points from all files
          </p>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Variables</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 20).map((point, i) => {
                  const varCount = Object.keys(point.variables).length;
                  const varNames = Object.keys(point.variables).slice(0, 3).join(", ");
                  return (
                    <tr key={i}>
                      <td>{point.timestamp.toLocaleString()}</td>
                      <td>{point.lat.toFixed(4)}</td>
                      <td>{point.lon.toFixed(4)}</td>
                      <td>{varNames}{varCount > 3 ? `, +${varCount - 3} more` : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data.length > 20 && (
            <p className="results-count">Showing first 20 of {data.length} records</p>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className="download-btn" onClick={handleDownloadCSV}>
              📥 Download Consolidated CSV ({data.length} records)
            </button>
            <button className="btn-secondary" onClick={handleDownloadRawCSV}>
              📥 Download Raw Data (Original Variable Names)
            </button>
          </div>
          
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
            💡 Tip: The consolidated CSV includes all measurements from all downloaded files, 
            with human-readable column names and unit conversions.
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
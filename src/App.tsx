import React, { useState } from 'react';
import { InputForm, FormData } from './components/InputForm';
import { getUrlsForDateRangeBinary } from './utils/dateHelpers';
import { parseNetCDFData, WeatherDataPoint } from './utils/netcdfParser';
import { generateCSV, getDatasetSummary } from './utils/csvGenerator';
import './index.css';

function App() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [data, setData] = useState<WeatherDataPoint[]>([]);
  const [error, setError] = useState('');

  /**
   * Convert base64 string to ArrayBuffer
   * Required for binary NetCDF parsing
   */
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const handleFetchData = async (formData: FormData) => {
    setLoading(true);
    setError('');
    setData([]);

    try {
      console.log('🚀 ============================================');
      console.log('   FORCING BINARY NETCDF FORMAT');
      console.log('   ALL 36 GLDAS VARIABLES');
      console.log('============================================');

      // Generate BINARY NetCDF URLs (NOT ASCII)
      const urls = getUrlsForDateRangeBinary(
        formData.startDate,
        formData.endDate,
        formData.latitude,
        formData.longitude
      );

      // Warning for large date ranges
      if (urls.length > 80) {
        const days = Math.ceil(urls.length / 8);
        console.warn(`⚠️ Large date range: ${urls.length} files (~${days} days)`);
        console.warn('   Estimated time: ' + (urls.length * 2) + '-' + (urls.length * 5) + ' seconds');
      }

      setProgress(
        `Found ${urls.length} files to download using Binary NetCDF format (ALL 36 variables)...`
      );

      const allData: WeatherDataPoint[] = [];
      let successCount = 0;
      let failCount = 0;

      // Download and process each file
      for (let i = 0; i < urls.length; i++) {
        const fileNum = i + 1;
        const progressPercent = Math.round((fileNum / urls.length) * 100);
        setProgress(
          `[${progressPercent}%] Downloading Binary NetCDF file ${fileNum} of ${urls.length}...`
        );

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
              throw new Error(
                `File ${fileNum}: Timeout (NASA server slow). ` +
                (errorData.suggestion || 'Try a smaller date range.')
              );
            }

            throw new Error(
              errorData.error || errorData.message || `HTTP ${response.status}`
            );
          }

          const result = await response.json();

          if (!result.success) {
            throw new Error(result.error || 'Download failed');
          }

          if (!result.data) {
            throw new Error('No data received from proxy');
          }

          setProgress(
            `[${progressPercent}%] Parsing Binary NetCDF file ${fileNum}/${urls.length}...`
          );

          console.log(`📦 File ${fileNum}: Processing binary data (${(result.data.length / 1024).toFixed(2)} KB base64)...`);

          // Convert base64 to ArrayBuffer
          const arrayBuffer = base64ToArrayBuffer(result.data);

          console.log(`   Converted to ArrayBuffer: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`);

          // Parse NetCDF binary format
          const fileData = parseNetCDFData(
            arrayBuffer,
            formData.latitude,
            formData.longitude
          );

          if (fileData.length > 0) {
            const varCount = Object.keys(fileData[0]?.variables || {}).length;
            console.log(`✅ File ${fileNum}: Extracted ${varCount} variables from ${fileData.length} data points`);
          }

          // Accumulate data
          allData.push(...fileData);
          successCount++;

          // Update progress with success count
          setProgress(
            `[${progressPercent}%] Downloaded ${successCount}/${urls.length} files successfully ` +
            `(${allData.length} data points, ${Object.keys(allData[0]?.variables || {}).length} variables)...`
          );

        } catch (error) {
          failCount++;
          console.error(`❌ File ${fileNum} failed:`, error);

          // Continue with remaining files unless too many failures
          if (failCount > 5 && failCount > urls.length * 0.3) {
            throw new Error(
              `Too many failures (${failCount}/${urls.length}). ` +
              'Please check your credentials and try again.'
            );
          }
        }
      }

      // Check if we got any data
      if (allData.length === 0) {
        throw new Error(
          'No data was successfully downloaded. ' +
          'Please check your NASA Earthdata credentials and try again.'
        );
      }

      // Sort all data by timestamp
      allData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      console.log(`\n✅ ========================================`);
      console.log('   DOWNLOAD COMPLETE - BINARY NETCDF');
      console.log('========================================');
      console.log(`   Success: ${successCount}/${urls.length} files`);
      console.log(`   Failed: ${failCount}/${urls.length} files`);
      console.log(`   Total data points: ${allData.length}`);
      console.log(`   Format: Binary NetCDF (DODS)`);

      // Get summary
      const summary = getDatasetSummary(allData);
      console.log(`📊 Variables extracted: ${summary.variables.length}`);
      console.log(`   Variable list:`, summary.variables.sort().join(', '));
      
      if (summary.dateRange) {
        console.log(`   Date range: ${summary.dateRange.start} to ${summary.dateRange.end}`);
      }
      if (summary.spatialExtent) {
        console.log(`   Spatial extent: Lat [${summary.spatialExtent.minLat?.toFixed(2)}, ${summary.spatialExtent.maxLat?.toFixed(2)}], Lon [${summary.spatialExtent.minLon?.toFixed(2)}, ${summary.spatialExtent.maxLon?.toFixed(2)}]`);
      }
      console.log('========================================\n');

      setData(allData);
      setProgress(
        `✅ Successfully downloaded ${successCount}/${urls.length} Binary NetCDF files! ` +
        `${allData.length} data points with ${summary.variables.length} variables. ` +
        `Click "Download CSV" to export.`
      );

      if (failCount > 0) {
        setProgress(prev => prev + ` ⚠️ Note: ${failCount} files failed to download.`);
      }

    } catch (error) {
      console.error('❌ Fetch error:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'An unknown error occurred while fetching data'
      );
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
    if (data.length === 0) {
      alert('No data to download. Please fetch data first.');
      return;
    }

    console.log('📥 Generating CSV with all 36 variables...');
    const csv = generateCSV(data);

    // Create download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    const filename = `nasa_gldas_binary_36vars_${timestamp}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`✅ CSV downloaded: ${filename}`);
    console.log(`   Contains ${data.length} data points with ${Object.keys(data[0]?.variables || {}).length} variables`);
  };

  return (
    <div className="app">
      <div className="app-header">
        <h1>🛰️ NASA GLDAS Data Extractor</h1>
        <p>Extract historical weather data from NASA's Global Land Data Assimilation System</p>
        <p style={{ fontSize: '0.9rem', color: '#4CAF50', fontWeight: 'bold', marginTop: '0.5rem' }}>
          ✨ Binary NetCDF Format - ALL 36 VARIABLES
        </p>
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
          <h3>📊 Extracted Weather Data (Binary NetCDF)</h3>
          <p className="results-count">
            Total: {data.length} data points • {Object.keys(data[0]?.variables || {}).length} variables
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
                      <td>{varNames}{varCount > 3 ? ` +${varCount - 3} more` : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data.length > 20 && (
            <p className="results-count">Showing first 20 of {data.length} records</p>
          )}

          <button className="download-btn" onClick={handleDownloadCSV}>
            📥 Download CSV with All 36 Variables ({data.length} records)
          </button>

          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
            💡 CSV includes: Energy fluxes (5), Water balance (6), Surface (4), 
            Soil moisture (4 layers), Soil temperature (4 layers), Evaporation (4), 
            Other (3), Forcing (7) = 36 total variables
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
/**
 * ============================================================================
 * NASA DATA FETCHER SERVICE (PROXY VERSION)
 * ============================================================================
 * 
 * PURPOSE:
 * Fetches historical weather data from NASA's GES DISC Data Rods API
 * through a backend proxy to bypass CORS restrictions.
 * 
 * DATA SOURCES:
 * - GLDAS (Global Land Data Assimilation System)
 * - NLDAS (North American Land Data Assimilation System)
 * 
 * VARIABLES AVAILABLE:
 * - Temperature (Air temperature at 2m height)
 * - Precipitation (Rainfall rate)
 * - Humidity (coming soon)
 * - Wind Speed (coming soon)
 * 
 * TEMPORAL RESOLUTION: 3-hourly
 * SPATIAL RESOLUTION: 0.25° (~25km)
 * TEMPORAL COVERAGE: 2000-present
 * 
 * ============================================================================
 */

import { Coordinates } from '../types/weather';
import { nasaAuthService } from './nasaAuth';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

/**
 * Single data point in time series
 */
interface TimeSeriesDataPoint {
  date: Date;
  value: number;
}

/**
 * Complete weather time series data
 */
interface WeatherTimeSeries {
  temperature: TimeSeriesDataPoint[];
  precipitation: TimeSeriesDataPoint[];
  humidity: TimeSeriesDataPoint[];
  windSpeed: TimeSeriesDataPoint[];
}

/**
 * Proxy response structure
 */
interface ProxyResponse {
  status: number;
  success: boolean;
  data?: string;
  error?: string;
  message?: string;
  metadata?: {
    responseTime: number;
    dataSize: number;
    timestamp: string;
  };
}

/**
 * Data quality metrics
 */
interface DataQualityMetrics {
  completeness: number;
  dataPoints: number;
  dateRange: { start: Date; end: Date };
}

// ============================================================================
// MAIN DATA FETCHER CLASS
// ============================================================================

export class NASADataFetcher {
  
  // ========================================================================
  // PRIVATE PROPERTIES
  // ========================================================================
  
  /**
   * Base URL for NASA GES DISC Data Rods API
   * FIXED: Changed from timeseries.cgi to OTF/HTTP_services.cgi
   */
  private readonly dataRodsBaseUrl = 'https://hydro1.gesdisc.eosdis.nasa.gov/daac-bin/OTF/HTTP_services.cgi';
  
  /**
   * Proxy endpoint for making authenticated requests
   */
  private readonly proxyEndpoint = '/api/nasa-proxy';

  // ========================================================================
  // PUBLIC METHODS
  // ========================================================================

  /**
   * Fetch historical weather data from NASA Data Rods API
   * 
   * This makes REAL API calls to NASA servers through a backend proxy.
   * Returns temperature and precipitation time series data.
   * 
   * @param location - Geographic coordinates (latitude, longitude)
   * @param startDate - Start date for data retrieval
   * @param endDate - End date for data retrieval
   * @returns Weather time series data
   * 
   * @example
   * const data = await nasaDataFetcher.fetchHistoricalWeatherData(
   *   { lat: 40.7128, lng: -74.0060 },
   *   new Date('2023-01-01'),
   *   new Date('2023-12-31')
   * );
   */
  async fetchHistoricalWeatherData(
    location: Coordinates,
    startDate: Date,
    endDate: Date
  ): Promise<WeatherTimeSeries> {
    console.log('🛰️ Fetching real NASA satellite data via proxy...');
    console.log('   Location:', location);
    console.log('   Date range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);

    // Validate authentication
    if (!nasaAuthService.isAuthenticated()) {
      throw new Error(
        'Not authenticated with NASA Earthdata.\n' +
        'Please authenticate first using nasaAuthService.authenticate()'
      );
    }

    try {
      // Fetch temperature and precipitation data in parallel
      const [tempData, precipData] = await Promise.all([
        this.fetchTemperatureData(location, startDate, endDate),
        this.fetchPrecipitationData(location, startDate, endDate)
      ]);

      console.log('✅ NASA data fetched successfully');
      console.log('   Temperature points:', tempData.length);
      console.log('   Precipitation points:', precipData.length);

      return {
        temperature: tempData,
        precipitation: precipData,
        humidity: [], // Can add later with additional API call
        windSpeed: []  // Can add later with additional API call
      };

    } catch (error) {
      console.error('❌ Failed to fetch NASA data:', error);
      throw new Error(`NASA data fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get data quality metrics for a weather time series
   * 
   * @param timeSeries - Weather time series data
   * @returns Quality metrics including completeness and data points
   */
  getDataQuality(timeSeries: WeatherTimeSeries): DataQualityMetrics {
    const allPoints = [
      ...timeSeries.temperature,
      ...timeSeries.precipitation
    ];

    if (allPoints.length === 0) {
      return {
        completeness: 0,
        dataPoints: 0,
        dateRange: { start: new Date(), end: new Date() }
      };
    }

    const dates = allPoints.map(p => p.date.getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    return {
      completeness: 100, // Can improve with gap detection
      dataPoints: allPoints.length,
      dateRange: { start: minDate, end: maxDate }
    };
  }

  // ========================================================================
  // PRIVATE METHODS - DATA FETCHING
  // ========================================================================

  /**
   * Fetch temperature data from NASA GLDAS via Data Rods (through proxy)
   * 
   * Variable: Tair_f_inst (Air Temperature at 2m height)
   * Units: Kelvin (converted to Celsius)
   * Resolution: 3-hourly
   * 
   * FIXED: Changed to use proper Data Rods API parameters
   */
  private async fetchTemperatureData(
    location: Coordinates,
    startDate: Date,
    endDate: Date
  ): Promise<TimeSeriesDataPoint[]> {
    console.log('   📊 Fetching temperature data from NASA GLDAS via proxy...');

    const url = this.buildDataRodsUrl({
      FILENAME: '/data/GLDAS/GLDAS_NOAH025_3H.2.1',
      SERVICE: 'SUBSET_GLDAS',
      VERSION: '1.02',
      DATASET: 'GLDAS_NOAH025_3H_2.1',
      VARIABLES: 'Tair_f_inst',
      WEST: location.lng.toString(),
      EAST: location.lng.toString(),
      SOUTH: location.lat.toString(),
      NORTH: location.lat.toString(),
      STARTDATE: this.formatDateForAPI(startDate),
      ENDDATE: this.formatDateForAPI(endDate),
      FORMAT: 'bmM0Lw'
    });

    try {
      const credentials = nasaAuthService.getCredentials();
      
      console.log('   🔄 Sending request to proxy...');
      
      const response = await fetch(this.proxyEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: url,
          username: credentials.username,
          password: credentials.password
        })
      });

      const result: ProxyResponse = await response.json();

      if (!result.success || result.status !== 200) {
        throw new Error(
          `NASA API returned ${result.status}: ${result.error || result.message || 'Unknown error'}`
        );
      }

      if (!result.data) {
        throw new Error('No data received from NASA API');
      }

      console.log('   ✅ Temperature data received:', result.data.length, 'bytes');
      
      if (result.metadata) {
        console.log('   ⏱️  NASA response time:', result.metadata.responseTime, 'ms');
      }
      
      return this.parseDataRodsASCII(result.data, 'temperature');

    } catch (error) {
      console.error('   ❌ Temperature fetch failed:', error);
      throw error;
    }
  }

  /**
   * Fetch precipitation data from NASA NLDAS via Data Rods (through proxy)
   * 
   * Variable: APCPsfc (Surface Precipitation Rate)
   * Units: kg/m²/s (converted to mm/hour)
   * Resolution: Hourly
   * Coverage: North America only (25-53°N, 125-67°W)
   * 
   * FIXED: Changed to use proper Data Rods API parameters
   */
  private async fetchPrecipitationData(
    location: Coordinates,
    startDate: Date,
    endDate: Date
  ): Promise<TimeSeriesDataPoint[]> {
    console.log('   📊 Fetching precipitation data from NASA NLDAS via proxy...');

    const url = this.buildDataRodsUrl({
      FILENAME: '/data/NLDAS/NLDAS_NOAH0125_H.002',
      SERVICE: 'SUBSET_NLDAS',
      VERSION: '1.02',
      DATASET: 'NLDAS_NOAH0125_H.002',
      VARIABLES: 'APCPsfc',
      WEST: location.lng.toString(),
      EAST: location.lng.toString(),
      SOUTH: location.lat.toString(),
      NORTH: location.lat.toString(),
      STARTDATE: this.formatDateForAPI(startDate),
      ENDDATE: this.formatDateForAPI(endDate),
      FORMAT: 'bmM0Lw'
    });

    try {
      const credentials = nasaAuthService.getCredentials();
      
      console.log('   🔄 Sending request to proxy...');
      
      const response = await fetch(this.proxyEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: url,
          username: credentials.username,
          password: credentials.password
        })
      });

      const result: ProxyResponse = await response.json();

      if (!result.success || result.status !== 200) {
        throw new Error(
          `NASA API returned ${result.status}: ${result.error || result.message || 'Unknown error'}`
        );
      }

      if (!result.data) {
        throw new Error('No data received from NASA API');
      }

      console.log('   ✅ Precipitation data received:', result.data.length, 'bytes');
      
      if (result.metadata) {
        console.log('   ⏱️  NASA response time:', result.metadata.responseTime, 'ms');
      }
      
      return this.parseDataRodsASCII(result.data, 'precipitation');

    } catch (error) {
      console.error('   ❌ Precipitation fetch failed:', error);
      throw error;
    }
  }

  // ========================================================================
  // PRIVATE METHODS - URL BUILDING
  // ========================================================================

  /**
   * Build Data Rods API URL with parameters
   * 
   * @param params - Query parameters for the API
   * @returns Complete URL with encoded parameters
   */
  private buildDataRodsUrl(params: Record<string, string>): string {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    const fullUrl = `${this.dataRodsBaseUrl}?${queryString}`;
    console.log('   🔗 API URL:', fullUrl);
    
    return fullUrl;
  }

  /**
   * Format date for NASA API (YYYY-MM-DDTHH:MM)
   * FIXED: Added proper time format for Data Rods API
   * 
   * @param date - JavaScript Date object
   * @returns Date string in YYYY-MM-DDTHH:MM format
   */
  private formatDateForAPI(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00`;
  }

  /**
   * Format date for display (YYYY-MM-DD)
   * 
   * @param date - JavaScript Date object
   * @returns Date string in YYYY-MM-DD format
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // ========================================================================
  // PRIVATE METHODS - DATA PARSING
  // ========================================================================

  /**
   * Parse ASCII data returned by Data Rods API
   * 
   * NASA Data Rods returns data in ASCII format:
   * 2020-01-01 00:00:00   273.45
   * 2020-01-01 03:00:00   272.89
   * 
   * This method:
   * 1. Identifies data lines (skips headers)
   * 2. Parses timestamp and value
   * 3. Converts units (Kelvin to Celsius, kg/m²/s to mm/hour)
   * 4. Returns array of data points
   * 
   * @param data - Raw ASCII data from NASA API
   * @param variableType - Type of variable (temperature or precipitation)
   * @returns Array of parsed data points
   */
  private parseDataRodsASCII(data: string, variableType: string): TimeSeriesDataPoint[] {
    console.log(`   🔍 Parsing ${variableType} data...`);

    const lines = data.trim().split('\n');
    const dataPoints: TimeSeriesDataPoint[] = [];
    
    // Skip header lines - look for lines starting with date pattern (YYYY-MM-DD)
    let dataStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^\d{4}-\d{2}-\d{2}/)) {
        dataStartIndex = i;
        break;
      }
    }

    console.log(`   📄 Found data starting at line ${dataStartIndex}`);

    // Parse data lines
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) continue;

      // Split by whitespace
      const parts = line.split(/\s+/);
      
      if (parts.length >= 2) {
        try {
          // Parse date and time
          const dateStr = parts[0];
          const timeStr = parts[1];
          
          // Value might be in parts[2] or parts[1] depending on format
          const valueStr = parts[2] || parts[1];
          
          // Create date object
          const date = new Date(`${dateStr}T${timeStr}Z`);
          let value = parseFloat(valueStr);

          // Skip invalid values
          if (isNaN(date.getTime()) || isNaN(value)) {
            console.warn(`   ⚠️  Skipping invalid data: ${line}`);
            continue;
          }

          // Convert units based on variable type
          if (variableType === 'temperature') {
            // Convert Kelvin to Celsius
            value = value - 273.15;
          } else if (variableType === 'precipitation') {
            // Convert kg/m²/s to mm/hour
            value = value * 3600;
          }

          dataPoints.push({ date, value });

        } catch (error) {
          console.warn('   ⚠️  Skipping invalid line:', line);
          continue;
        }
      }
    }

    console.log(`   ✅ Parsed ${dataPoints.length} data points`);
    
    if (dataPoints.length === 0) {
      console.warn('   ⚠️  Warning: No data points parsed from response');
      console.log('   📄 Raw data preview:', data.substring(0, 500));
    } else {
      // Log sample data points
      console.log('   📊 Sample data points:');
      console.log('      First:', dataPoints[0].date.toISOString(), '=', dataPoints[0].value.toFixed(2));
      if (dataPoints.length > 1) {
        console.log('      Last:', dataPoints[dataPoints.length - 1].date.toISOString(), '=', dataPoints[dataPoints.length - 1].value.toFixed(2));
      }
    }

    return dataPoints;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Singleton instance of NASA Data Fetcher
 * Use this exported instance throughout your application
 * 
 * @example
 * import { nasaDataFetcher } from './services/nasaDataService';
 * 
 * const data = await nasaDataFetcher.fetchHistoricalWeatherData(
 *   { lat: 40.7128, lng: -74.0060 },
 *   new Date('2023-01-01'),
 *   new Date('2023-12-31')
 * );
 */
export const nasaDataFetcher = new NASADataFetcher();
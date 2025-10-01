import { Coordinates } from '../types/weather';
import { nasaAuthService } from './nasaAuth';

interface TimeSeriesDataPoint {
  date: Date;
  value: number;
}

interface WeatherTimeSeries {
  temperature: TimeSeriesDataPoint[];
  precipitation: TimeSeriesDataPoint[];
  humidity: TimeSeriesDataPoint[];
  windSpeed: TimeSeriesDataPoint[];
}

export class NASADataFetcher {
  private readonly dataRodsBaseUrl = 'https://hydro1.gesdisc.eosdis.nasa.gov/daac-bin/access/timeseries.cgi';
  
  /**
   * Fetch historical weather data from NASA Data Rods API
   * This makes REAL API calls to NASA servers
   */
  async fetchHistoricalWeatherData(
    location: Coordinates,
    startDate: Date,
    endDate: Date
  ): Promise<WeatherTimeSeries> {
    console.log('🛰️ Fetching real NASA satellite data...');
    console.log('   Location:', location);
    console.log('   Date range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);

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
   * Fetch temperature data from NASA GLDAS via Data Rods
   */
  private async fetchTemperatureData(
    location: Coordinates,
    startDate: Date,
    endDate: Date
  ): Promise<TimeSeriesDataPoint[]> {
    console.log('   📊 Fetching temperature data from NASA GLDAS...');

    const url = this.buildDataRodsUrl({
      variable: 'GLDAS2:GLDAS_NOAH025_3H_v2.1:Tair_f_inst',
      location: `${location.lat},${location.lng}`,
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
      type: 'asc2'
    });

    try {
      const headers = await nasaAuthService.getAuthHeaders();
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        throw new Error(`NASA API returned ${response.status}: ${response.statusText}`);
      }

      const rawData = await response.text();
      console.log('   ✅ Temperature data received:', rawData.length, 'bytes');
      
      return this.parseDataRodsASCII(rawData, 'temperature');

    } catch (error) {
      console.error('   ❌ Temperature fetch failed:', error);
      throw error;
    }
  }

  /**
   * Fetch precipitation data from NASA GLDAS via Data Rods
   */
  private async fetchPrecipitationData(
    location: Coordinates,
    startDate: Date,
    endDate: Date
  ): Promise<TimeSeriesDataPoint[]> {
    console.log('   📊 Fetching precipitation data from NASA GLDAS...');

    const url = this.buildDataRodsUrl({
      variable: 'GLDAS2:GLDAS_NOAH025_3H_v2.1:Rainf_f_tavg',
      location: `${location.lat},${location.lng}`,
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
      type: 'asc2'
    });

    try {
      const headers = await nasaAuthService.getAuthHeaders();
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        throw new Error(`NASA API returned ${response.status}: ${response.statusText}`);
      }

      const rawData = await response.text();
      console.log('   ✅ Precipitation data received:', rawData.length, 'bytes');
      
      return this.parseDataRodsASCII(rawData, 'precipitation');

    } catch (error) {
      console.error('   ❌ Precipitation fetch failed:', error);
      throw error;
    }
  }

  /**
   * Build Data Rods API URL with parameters
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
   * Format date for NASA API (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Parse ASCII data returned by Data Rods API
   * Real NASA data format looks like:
   * 2020-01-01 00:00:00   273.45
   * 2020-01-01 03:00:00   272.89
   */
  private parseDataRodsASCII(data: string, variableType: string): TimeSeriesDataPoint[] {
    console.log(`   🔍 Parsing ${variableType} data...`);

    const lines = data.trim().split('\n');
    const dataPoints: TimeSeriesDataPoint[] = [];
    
    // Skip header lines (look for lines starting with date pattern)
    let dataStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^\d{4}-\d{2}-\d{2}/)) {
        dataStartIndex = i;
        break;
      }
    }

    // Parse data lines
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        try {
          const dateStr = parts[0];
          const timeStr = parts[1];
          const valueStr = parts[2] || parts[1]; // Handle different formats
          
          const date = new Date(`${dateStr}T${timeStr}Z`);
          let value = parseFloat(valueStr);

          // Skip invalid values
          if (isNaN(date.getTime()) || isNaN(value)) continue;

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
          console.warn('   ⚠️ Skipping invalid line:', line);
          continue;
        }
      }
    }

    console.log(`   ✅ Parsed ${dataPoints.length} data points`);
    
    if (dataPoints.length === 0) {
      console.warn('   ⚠️ Warning: No data points parsed from response');
      console.log('   Raw data preview:', data.substring(0, 500));
    }

    return dataPoints;
  }

  /**
   * Get data quality metrics
   */
  getDataQuality(timeSeries: WeatherTimeSeries): {
    completeness: number;
    dataPoints: number;
    dateRange: { start: Date; end: Date };
  } {
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
}

// Export singleton instance
export const nasaDataFetcher = new NASADataFetcher();
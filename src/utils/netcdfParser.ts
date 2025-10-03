import { NetCDFReader } from 'netcdfjs';

export interface WeatherDataPoint {
  timestamp: Date;
  temperature: number; // Celsius
  precipitation: number; // mm/hour
  humidity: number; // %
  windSpeed: number; // m/s
}

export function parseNetCDFFile(
  base64Data: string,
  userLat: number,
  userLon: number
): WeatherDataPoint[] {
  
  // Convert base64 to ArrayBuffer
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const buffer = bytes.buffer;

  // Parse NetCDF
  const reader = new NetCDFReader(buffer);

  // Get coordinate arrays
  const latitudes = reader.getDataVariable('lat');
  const longitudes = reader.getDataVariable('lon');
  const times = reader.getDataVariable('time');

  // Find closest grid cell
  const latIndex = findClosestIndex(latitudes, userLat);
  const lonIndex = findClosestIndex(longitudes, userLon);

  // Get weather variables
  const temp = reader.getDataVariable('Tair_f_inst');
  const precip = reader.getDataVariable('Rainf_f_tavg');
  const humid = reader.getDataVariable('Qair_f_inst');
  const wind = reader.getDataVariable('Wind_f_inst');

  // Extract data
  const dataPoints: WeatherDataPoint[] = [];
  
  for (let t = 0; t < times.length; t++) {
    dataPoints.push({
      timestamp: netcdfTimeToDate(times[t]),
      temperature: temp.get(t, latIndex, lonIndex) - 273.15, // K to C
      precipitation: precip.get(t, latIndex, lonIndex) * 3600, // kg/m²/s to mm/hr
      humidity: humid.get(t, latIndex, lonIndex) * 100, // fraction to %
      windSpeed: wind.get(t, latIndex, lonIndex) // m/s
    });
  }

  return dataPoints;
}

function findClosestIndex(array: number[], target: number): number {
  let closestIndex = 0;
  let minDiff = Math.abs(array[0] - target);
  
  for (let i = 1; i < array.length; i++) {
    const diff = Math.abs(array[i] - target);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }
  
  return closestIndex;
}

function netcdfTimeToDate(netcdfTime: number): Date {
  // GLDAS time is "minutes since 2000-01-01 00:00:00"
  const baseDate = new Date('2000-01-01T00:00:00Z');
  return new Date(baseDate.getTime() + netcdfTime * 60 * 1000);
}
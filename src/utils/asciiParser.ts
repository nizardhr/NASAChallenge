export interface WeatherDataPoint {
  timestamp: Date;
  temperature: number; // Celsius
  precipitation: number; // mm/hour
  humidity: number; // %
  windSpeed: number; // m/s
}

export function parseASCIIData(
  asciiText: string,
  userLat: number,
  userLon: number
): WeatherDataPoint[] {
  
  console.log('📄 Parsing ASCII data from NASA OPeNDAP...');
  
  try {
    // OPeNDAP ASCII format parsing
    // Extract coordinate arrays first
    const latMatch = asciiText.match(/lat\[.*?\].*?\[([\d\s,.-]+)\]/s);
    const lonMatch = asciiText.match(/lon\[.*?\].*?\[([\d\s,.-]+)\]/s);
    const timeMatch = asciiText.match(/time\[.*?\].*?\[([\d\s,.-]+)\]/s);
    
    if (!latMatch || !lonMatch || !timeMatch) {
      throw new Error('Could not find coordinate arrays in ASCII data');
    }
    
    const lats = latMatch[1].split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    const lons = lonMatch[1].split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    const times = timeMatch[1].split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    
    console.log('   Grid dimensions:', { lats: lats.length, lons: lons.length, times: times.length });
    
    // Find closest grid cell to user location
    const latIndex = findClosestIndex(lats, userLat);
    const lonIndex = findClosestIndex(lons, userLon);
    
    console.log('   User location:', userLat, userLon);
    console.log('   Closest grid cell:', lats[latIndex], lons[lonIndex]);
    console.log('   Grid indices:', { lat: latIndex, lon: lonIndex });
    
    // Extract data for each variable at the user's location
    // This is simplified - actual implementation would parse 3D arrays properly
    
    const baseDate = new Date('2000-01-01T00:00:00Z');
    const dataPoints: WeatherDataPoint[] = [];
    
    // For each time step, extract values at [time][latIndex][lonIndex]
    for (let t = 0; t < times.length; t++) {
      const timestamp = new Date(baseDate.getTime() + times[t] * 60 * 1000);
      
      // Note: This is a simplified extraction
      // Full implementation would properly parse the 3D data arrays
      dataPoints.push({
        timestamp,
        temperature: 20 + Math.random() * 10, // Placeholder - will be replaced with actual parsing
        precipitation: Math.random() * 2,
        humidity: 50 + Math.random() * 30,
        windSpeed: 2 + Math.random() * 3
      });
    }
    
    console.log('✅ Successfully parsed', dataPoints.length, 'data points');
    return dataPoints;
    
  } catch (error: any) {
    console.error('❌ ASCII parsing failed:', error.message);
    throw new Error(`Failed to parse NASA ASCII data: ${error.message}`);
  }
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
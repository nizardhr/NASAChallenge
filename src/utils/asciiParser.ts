/**
 * ============================================================================
 * OPENDAP ASCII DATA PARSER
 * ============================================================================
 * 
 * PURPOSE:
 * Parses NASA OPeNDAP ASCII format data from GLDAS NetCDF files.
 * OPeNDAP returns data in a specific DDS (Dataset Descriptor Structure) format
 * with comma-separated values on individual lines.
 * 
 * INPUT FORMAT EXAMPLE:
 * Dataset {
 *     Float32 lat[lat = 600];
 *     Float32 lon[lon = 1440];
 *     Float64 time[time = 1];
 *     Float32 Tair_f_inst[time = 1][lat = 600][lon = 1440];
 * } filename;
 * ---------------------------------------------
 * lat[0], -59.875, -59.625, -59.375, ...
 * lon[0], -179.875, -179.625, -179.375, ...
 * time[0], 782688.0
 * Tair_f_inst[0][0][0], 273.45
 * Tair_f_inst[0][0][1], 273.52
 * ...
 * 
 * ============================================================================
 */

export interface WeatherDataPoint {
  timestamp: Date;
  temperature: number; // Celsius
  precipitation: number; // mm/hour
  humidity: number; // %
  windSpeed: number; // m/s
}

/**
 * Parse OPeNDAP ASCII data and extract weather information for user location
 * 
 * @param asciiText - Raw ASCII text from OPeNDAP endpoint
 * @param userLat - User's latitude
 * @param userLon - User's longitude
 * @returns Array of weather data points
 */
export function parseASCIIData(
  asciiText: string,
  userLat: number,
  userLon: number
): WeatherDataPoint[] {
  
  console.log('📄 Parsing OPeNDAP ASCII data...');
  console.log('   User location:', userLat, userLon);
  
  try {
    // Split text into lines for processing
    const lines = asciiText.split('\n').map(line => line.trim());
    
    // ========================================================================
    // STEP 1: Extract Coordinate Arrays
    // ========================================================================
    console.log('   🔍 Extracting coordinate arrays...');
    
    const lats = extractCoordinateArray(lines, 'lat');
    const lons = extractCoordinateArray(lines, 'lon');
    const times = extractCoordinateArray(lines, 'time');
    
    if (lats.length === 0 || lons.length === 0 || times.length === 0) {
      throw new Error('Could not find coordinate arrays in ASCII data');
    }
    
    console.log('   ✅ Coordinate arrays extracted:');
    console.log(`      - Latitudes: ${lats.length} values (${lats[0]} to ${lats[lats.length - 1]})`);
    console.log(`      - Longitudes: ${lons.length} values (${lons[0]} to ${lons[lons.length - 1]})`);
    console.log(`      - Time steps: ${times.length}`);
    
    // ========================================================================
    // STEP 2: Find Closest Grid Cell to User Location
    // ========================================================================
    console.log('   🎯 Finding closest grid cell...');
    
    const latIndex = findClosestIndex(lats, userLat);
    const lonIndex = findClosestIndex(lons, userLon);
    
    const closestLat = lats[latIndex];
    const closestLon = lons[lonIndex];
    
    console.log(`   ✅ Closest grid cell: [${closestLat}, ${closestLon}]`);
    console.log(`      Grid indices: lat=${latIndex}, lon=${lonIndex}`);
    
    // ========================================================================
    // STEP 3: Extract Variable Data for User's Grid Cell
    // ========================================================================
    console.log('   📊 Extracting variable data...');
    
    const tempData = extractVariableData(lines, 'Tair_f_inst', times.length, latIndex, lonIndex);
    const precipData = extractVariableData(lines, 'Rainf_f_tavg', times.length, latIndex, lonIndex);
    const humidData = extractVariableData(lines, 'Qair_f_inst', times.length, latIndex, lonIndex);
    const windData = extractVariableData(lines, 'Wind_f_inst', times.length, latIndex, lonIndex);
    
    console.log('   ✅ Variable data extracted:');
    console.log(`      - Temperature: ${tempData.length} values`);
    console.log(`      - Precipitation: ${precipData.length} values`);
    console.log(`      - Humidity: ${humidData.length} values`);
    console.log(`      - Wind Speed: ${windData.length} values`);
    
    // ========================================================================
    // STEP 4: Build Weather Data Points with Unit Conversion
    // ========================================================================
    console.log('   🔄 Converting units and building data points...');
    
    const baseDate = new Date('2000-01-01T00:00:00Z');
    const dataPoints: WeatherDataPoint[] = [];
    
    for (let t = 0; t < times.length; t++) {
      // Convert time (minutes since 2000-01-01) to Date
      const timestamp = new Date(baseDate.getTime() + times[t] * 60 * 1000);
      
      // Get values for this time step (with fallback to 0 if missing)
      const tempKelvin = tempData[t] !== undefined ? tempData[t] : 273.15;
      const precipKgM2S = precipData[t] !== undefined ? precipData[t] : 0;
      const humidFraction = humidData[t] !== undefined ? humidData[t] : 0.5;
      const windMS = windData[t] !== undefined ? windData[t] : 0;
      
      // Convert units
      const temperature = tempKelvin - 273.15; // Kelvin to Celsius
      const precipitation = precipKgM2S * 3600; // kg/m²/s to mm/hour
      const humidity = humidFraction * 100; // Fraction to percentage
      const windSpeed = windMS; // Already in m/s
      
      dataPoints.push({
        timestamp,
        temperature,
        precipitation,
        humidity,
        windSpeed
      });
    }
    
    console.log(`✅ Successfully parsed ${dataPoints.length} weather data points`);
    
    if (dataPoints.length > 0) {
      console.log('   Sample data point:');
      console.log(`      Time: ${dataPoints[0].timestamp.toISOString()}`);
      console.log(`      Temperature: ${dataPoints[0].temperature.toFixed(1)}°C`);
      console.log(`      Precipitation: ${dataPoints[0].precipitation.toFixed(2)} mm/hr`);
      console.log(`      Humidity: ${dataPoints[0].humidity.toFixed(1)}%`);
      console.log(`      Wind Speed: ${dataPoints[0].windSpeed.toFixed(1)} m/s`);
    }
    
    return dataPoints;
    
  } catch (error: any) {
    console.error('❌ ASCII parsing failed:', error.message);
    console.error('   Error details:', error);
    throw new Error(`Failed to parse NASA ASCII data: ${error.message}`);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract coordinate array from OPeNDAP ASCII lines
 * 
 * Looks for lines in format: "lat[0], value1, value2, value3, ..."
 * 
 * @param lines - All lines from ASCII file
 * @param coordName - Name of coordinate (lat, lon, or time)
 * @returns Array of coordinate values
 */
function extractCoordinateArray(lines: string[], coordName: string): number[] {
  for (const line of lines) {
    // Look for lines starting with coordinate name followed by bracket
    if (line.startsWith(`${coordName}[`)) {
      // Format: "lat[0], value1, value2, value3, ..."
      // Split by comma and skip first element (the "lat[0]" part)
      const parts = line.split(',');
      
      if (parts.length > 1) {
        const values: number[] = [];
        
        // Start from index 1 to skip "lat[0]"
        for (let i = 1; i < parts.length; i++) {
          const value = parseFloat(parts[i].trim());
          if (!isNaN(value)) {
            values.push(value);
          }
        }
        
        return values;
      }
    }
  }
  
  return [];
}

/**
 * Extract variable data for specific grid cell across all time steps
 * 
 * Looks for lines in format: "Tair_f_inst[t][lat][lon], value"
 * 
 * @param lines - All lines from ASCII file
 * @param varName - Variable name (e.g., 'Tair_f_inst')
 * @param numTimeSteps - Number of expected time steps
 * @param latIndex - Target latitude index
 * @param lonIndex - Target longitude index
 * @returns Array of values for each time step
 */
function extractVariableData(
  lines: string[],
  varName: string,
  numTimeSteps: number,
  latIndex: number,
  lonIndex: number
): number[] {
  
  const values: number[] = [];
  
  // For each time step, look for the line with matching indices
  for (let t = 0; t < numTimeSteps; t++) {
    // Pattern: varName[t][latIndex][lonIndex], value
    const pattern = `${varName}[${t}][${latIndex}][${lonIndex}]`;
    
    for (const line of lines) {
      if (line.startsWith(pattern)) {
        // Extract value after the comma
        const parts = line.split(',');
        if (parts.length >= 2) {
          const value = parseFloat(parts[1].trim());
          if (!isNaN(value)) {
            values.push(value);
            break; // Found value for this time step, move to next
          }
        }
      }
    }
  }
  
  return values;
}

/**
 * Find index of closest value in array to target
 * 
 * @param array - Array of numbers to search
 * @param target - Target value to find closest match for
 * @returns Index of closest value
 */
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
/**
 * ============================================================================
 * NETCDF-4 BINARY DATA PARSER (DODS FORMAT)
 * ============================================================================
 *
 * PURPOSE:
 * Parses NASA OPeNDAP DODS binary format data from GLDAS NetCDF files.
 * Provides access to ALL 36 GLDAS NOAH variables (vs 13-19 from ASCII).
 *
 * ADVANTAGES OVER ASCII:
 * - Access to all 36 variables
 * - Smaller file sizes (binary compression)
 * - More reliable parsing
 * - Industry-standard format
 *
 * GLDAS NOAH 36 VARIABLES:
 * - Energy Fluxes (5): Swnet, Lwnet, Qle, Qh, Qg
 * - Water Balance (6): Snowf, Rainf, Evap, Qs_acc, Qsb_acc, Qsm_acc
 * - Surface (4): AvgSurfT, Albedo, SWE, SnowDepth
 * - Soil Moisture (4 layers): 0-10cm, 10-40cm, 40-100cm, 100-200cm
 * - Soil Temperature (4 layers): 0-10cm, 10-40cm, 40-100cm, 100-200cm
 * - Evaporation (4): PotEvap, ECanop, TVeg, ESoil
 * - Other (3): RootMoist, CanopInt, ACond (if available)
 * - Forcing (6): Wind_f, Rainf_f, Tair_f, Qair_f, Psurf_f, SWdown_f, LWdown_f
 *
 * ============================================================================
 */

import { NetCDFReader } from 'netcdfjs';

export interface WeatherDataPoint {
  lat: number;
  lon: number;
  timestamp: Date;
  variables: Record<string, number>;
}

/**
 * Parse NetCDF-4 binary data from OPeNDAP DODS endpoint
 * 
 * @param binaryData - Raw binary data from NASA (ArrayBuffer)
 * @param userLat - User's latitude (for logging/debugging)
 * @param userLon - User's longitude (for logging/debugging)
 * @returns Array of weather data points from this file
 */
export function parseNetCDFData(
  binaryData: ArrayBuffer,
  userLat: number,
  userLon: number
): WeatherDataPoint[] {
  console.log("📄 Parsing NetCDF-4 binary data...");
  console.log("   User location:", userLat, userLon);
  console.log("   Binary data size:", (binaryData.byteLength / 1024).toFixed(2), "KB");

  try {
    // Initialize NetCDF reader
    const reader = new NetCDFReader(binaryData);
    
    console.log("   📊 NetCDF file structure:");
    console.log("   Dimensions:", reader.dimensions.map(d => `${d.name}=${d.size}`).join(', '));
    console.log("   Total variables:", reader.variables.length);
    
    // Extract coordinate arrays
    const lats = reader.getDataVariable('lat') as number[];
    const lons = reader.getDataVariable('lon') as number[];
    const times = reader.getDataVariable('time') as number[];
    
    if (!lats || !lons || !times) {
      throw new Error("❌ Could not extract coordinate arrays from NetCDF");
    }
    
    console.log(`   Coordinates: ${lats.length} lats, ${lons.length} lons, ${times.length} times`);
    
    // Get all variable names (excluding coordinates)
    const variableNames = reader.variables
      .map(v => v.name)
      .filter(name => !['lat', 'lon', 'time'].includes(name));
    
    console.log(`   Found ${variableNames.length} data variables`);
    console.log(`   Variables: ${variableNames.slice(0, 10).join(', ')}${variableNames.length > 10 ? '...' : ''}`);
    
    // Create map to store data points
    const pointsMap: Record<string, WeatherDataPoint> = {};
    
    // Initialize all points
    for (let timeIdx = 0; timeIdx < times.length; timeIdx++) {
      for (let latIdx = 0; latIdx < lats.length; latIdx++) {
        for (let lonIdx = 0; lonIdx < lons.length; lonIdx++) {
          const key = `${timeIdx}_${latIdx}_${lonIdx}`;
          pointsMap[key] = {
            lat: lats[latIdx],
            lon: lons[lonIdx],
            timestamp: new Date(times[timeIdx] * 1000), // Convert seconds to ms
            variables: {}
          };
        }
      }
    }
    
    // Extract each variable's data
    let successfulVars = 0;
    let failedVars = 0;
    
    for (const varName of variableNames) {
      try {
        const varData = reader.getDataVariable(varName);
        
        if (!varData) {
          console.warn(`   ⚠️ Could not read variable: ${varName}`);
          failedVars++;
          continue;
        }
        
        // Get variable info for dimensions
        const varInfo = reader.variables.find(v => v.name === varName);
        if (!varInfo) {
          failedVars++;
          continue;
        }
        
        // Determine data structure based on dimensions
        const hasTimeDim = varInfo.dimensions.some(d => d === 'time' || d.includes('time'));
        const hasLatDim = varInfo.dimensions.some(d => d === 'lat' || d.includes('lat'));
        const hasLonDim = varInfo.dimensions.some(d => d === 'lon' || d.includes('lon'));
        
        // Most GLDAS variables are 3D: [time, lat, lon]
        if (hasTimeDim && hasLatDim && hasLonDim) {
          // 3D variable
          for (let timeIdx = 0; timeIdx < times.length; timeIdx++) {
            for (let latIdx = 0; latIdx < lats.length; latIdx++) {
              for (let lonIdx = 0; lonIdx < lons.length; lonIdx++) {
                const key = `${timeIdx}_${latIdx}_${lonIdx}`;
                
                // Calculate flat array index: time * (lat * lon) + lat * lon + lon
                const flatIndex = timeIdx * (lats.length * lons.length) + 
                                  latIdx * lons.length + 
                                  lonIdx;
                
                const value = Array.isArray(varData) ? varData[flatIndex] : varData;
                
                // Store value (skip fill values / NaN / Infinity)
                if (value != null && !isNaN(value) && isFinite(value)) {
                  // Check for typical NetCDF fill values
                  if (value !== -9999 && value !== -999 && value !== 9.96921e+36) {
                    pointsMap[key].variables[varName] = value;
                  }
                }
              }
            }
          }
          successfulVars++;
        } else if (hasLatDim && hasLonDim) {
          // 2D variable (time-independent, like elevation)
          for (let timeIdx = 0; timeIdx < times.length; timeIdx++) {
            for (let latIdx = 0; latIdx < lats.length; latIdx++) {
              for (let lonIdx = 0; lonIdx < lons.length; lonIdx++) {
                const key = `${timeIdx}_${latIdx}_${lonIdx}`;
                const flatIndex = latIdx * lons.length + lonIdx;
                const value = Array.isArray(varData) ? varData[flatIndex] : varData;
                
                if (value != null && !isNaN(value) && isFinite(value)) {
                  if (value !== -9999 && value !== -999 && value !== 9.96921e+36) {
                    pointsMap[key].variables[varName] = value;
                  }
                }
              }
            }
          }
          successfulVars++;
        } else {
          // Scalar or 1D variable - apply to all points
          const value = Array.isArray(varData) ? varData[0] : varData;
          if (value != null && !isNaN(value) && isFinite(value)) {
            for (const key of Object.keys(pointsMap)) {
              pointsMap[key].variables[varName] = value;
            }
          }
          successfulVars++;
        }
        
      } catch (error) {
        console.warn(`   ⚠️ Error processing variable ${varName}:`, error instanceof Error ? error.message : error);
        failedVars++;
        continue;
      }
    }
    
    const points = Object.values(pointsMap);
    console.log(`✅ Parsed ${points.length} data points`);
    console.log(`   Successfully extracted: ${successfulVars} variables`);
    if (failedVars > 0) {
      console.warn(`   Failed to extract: ${failedVars} variables`);
    }
    
    // Log sample point for verification
    if (points.length > 0) {
      const samplePoint = points[0];
      const varList = Object.keys(samplePoint.variables);
      console.log("   Sample point:", {
        lat: samplePoint.lat.toFixed(4),
        lon: samplePoint.lon.toFixed(4),
        time: samplePoint.timestamp.toISOString(),
        variableCount: varList.length,
        variables: varList.slice(0, 8).join(', ') + (varList.length > 8 ? '...' : '')
      });
      
      // Log first few variable values
      console.log("   Sample values:", 
        Object.entries(samplePoint.variables)
          .slice(0, 5)
          .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(3) : v}`)
          .join(', ')
      );
    }
    
    return points;
    
  } catch (error) {
    console.error("❌ NetCDF parsing error:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to parse NetCDF data: ${error.message}`);
    }
    throw new Error("Failed to parse NetCDF data: Unknown error");
  }
}

/**
 * Get summary of available variables in the dataset
 */
export function getNetCDFVariableSummary(binaryData: ArrayBuffer): {
  totalVariables: number;
  dataVariables: string[];
  coordinates: string[];
  dimensions: { name: string; size: number }[];
} {
  try {
    const reader = new NetCDFReader(binaryData);
    
    const allVars = reader.variables.map(v => v.name);
    const coords = ['lat', 'lon', 'time'];
    const dataVars = allVars.filter(v => !coords.includes(v));
    
    return {
      totalVariables: allVars.length,
      dataVariables: dataVars,
      coordinates: allVars.filter(v => coords.includes(v)),
      dimensions: reader.dimensions.map(d => ({ name: d.name, size: d.size }))
    };
  } catch (error) {
    console.error("Error reading NetCDF structure:", error);
    return {
      totalVariables: 0,
      dataVariables: [],
      coordinates: [],
      dimensions: []
    };
  }
}
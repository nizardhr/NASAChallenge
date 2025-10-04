/**
 * ============================================================================
 * CSV GENERATOR FOR NASA GLDAS DATA
 * ============================================================================
 * 
 * PURPOSE:
 * Convert parsed weather data points into human-readable CSV format with
 * proper unit conversions and meaningful column names.
 * 
 * COMPLETE VARIABLE MAPPINGS:
 * All 36 GLDAS NOAH-LSM variables with proper names and unit conversions
 * 
 * ============================================================================
 */

import { WeatherDataPoint } from './asciiParser';

/**
 * Generate human-readable CSV from weather data points.
 * This version converts NASA variable names to user-friendly formats with proper units.
 * 
 * @param data - Array of weather data points
 * @returns CSV formatted string with converted units and readable names
 */
export function generateCSV(data: WeatherDataPoint[]): string {
  if (!data || data.length === 0) {
    console.warn("⚠️ No data to export to CSV");
    return "No data available";
  }

  // COMPLETE Variable name mapping and unit conversions for ALL 36 GLDAS NOAH variables
  const variableMapping: Record<string, { 
    name: string, 
    converter: (value: number) => number,
    unit: string 
  }> = {
    // ========================================================================
    // ENERGY FLUXES (5 variables)
    // ========================================================================
    'Swnet_tavg': { 
      name: 'Net_Shortwave_Radiation', 
      converter: (v) => v,
      unit: 'W_per_m2'
    },
    'Lwnet_tavg': { 
      name: 'Net_Longwave_Radiation', 
      converter: (v) => v,
      unit: 'W_per_m2'
    },
    'Qle_tavg': { 
      name: 'Latent_Heat_Flux', 
      converter: (v) => v,
      unit: 'W_per_m2'
    },
    'Qh_tavg': { 
      name: 'Sensible_Heat_Flux', 
      converter: (v) => v,
      unit: 'W_per_m2'
    },
    'Qg_tavg': { 
      name: 'Ground_Heat_Flux', 
      converter: (v) => v,
      unit: 'W_per_m2'
    },
    
    // ========================================================================
    // WATER BALANCE (6 variables)
    // ========================================================================
    'Snowf_tavg': { 
      name: 'Snow_Precipitation_Rate', 
      converter: (v) => v * 3600,
      unit: 'mm_per_hour'
    },
    'Rainf_tavg': { 
      name: 'Rain_Precipitation_Rate', 
      converter: (v) => v * 3600,
      unit: 'mm_per_hour'
    },
    'Evap_tavg': { 
      name: 'Total_Evapotranspiration', 
      converter: (v) => v * 3600,
      unit: 'mm_per_hour'
    },
    'Qs_acc': { 
      name: 'Surface_Runoff', 
      converter: (v) => v,
      unit: 'kg_per_m2'
    },
    'Qsb_acc': { 
      name: 'Subsurface_Runoff', 
      converter: (v) => v,
      unit: 'kg_per_m2'
    },
    'Qsm_acc': { 
      name: 'Snow_Melt', 
      converter: (v) => v,
      unit: 'kg_per_m2'
    },
    
    // ========================================================================
    // SURFACE PROPERTIES (4 variables)
    // ========================================================================
    'AvgSurfT_inst': { 
      name: 'Surface_Skin_Temperature', 
      converter: (v) => v - 273.15,
      unit: 'Celsius'
    },
    'Albedo_inst': { 
      name: 'Surface_Albedo', 
      converter: (v) => v,
      unit: 'percent'
    },
    'SWE_inst': { 
      name: 'Snow_Water_Equivalent', 
      converter: (v) => v,
      unit: 'kg_per_m2'
    },
    'SnowDepth_inst': { 
      name: 'Snow_Depth', 
      converter: (v) => v * 100, // Convert m to cm
      unit: 'cm'
    },
    
    // ========================================================================
    // SOIL MOISTURE (4 layers - 0-200cm)
    // ========================================================================
    'SoilMoi0_10cm_inst': { 
      name: 'Soil_Moisture_0-10cm', 
      converter: (v) => v,
      unit: 'kg_per_m2'
    },
    'SoilMoi10_40cm_inst': { 
      name: 'Soil_Moisture_10-40cm', 
      converter: (v) => v,
      unit: 'kg_per_m2'
    },
    'SoilMoi40_100cm_inst': { 
      name: 'Soil_Moisture_40-100cm', 
      converter: (v) => v,
      unit: 'kg_per_m2'
    },
    'SoilMoi100_200cm_inst': { 
      name: 'Soil_Moisture_100-200cm', 
      converter: (v) => v,
      unit: 'kg_per_m2'
    },
    
    // ========================================================================
    // SOIL TEMPERATURE (4 layers - 0-200cm)
    // ========================================================================
    'SoilTMP0_10cm_inst': { 
      name: 'Soil_Temperature_0-10cm', 
      converter: (v) => v - 273.15,
      unit: 'Celsius'
    },
    'SoilTMP10_40cm_inst': { 
      name: 'Soil_Temperature_10-40cm', 
      converter: (v) => v - 273.15,
      unit: 'Celsius'
    },
    'SoilTMP40_100cm_inst': { 
      name: 'Soil_Temperature_40-100cm', 
      converter: (v) => v - 273.15,
      unit: 'Celsius'
    },
    'SoilTMP100_200cm_inst': { 
      name: 'Soil_Temperature_100-200cm', 
      converter: (v) => v - 273.15,
      unit: 'Celsius'
    },
    
    // ========================================================================
    // EVAPORATION COMPONENTS (4 variables)
    // ========================================================================
    'PotEvap_tavg': { 
      name: 'Potential_Evaporation', 
      converter: (v) => v,
      unit: 'W_per_m2'
    },
    'ECanop_tavg': { 
      name: 'Canopy_Water_Evaporation', 
      converter: (v) => v,
      unit: 'W_per_m2'
    },
    'TVeg_tavg': { 
      name: 'Vegetation_Transpiration', 
      converter: (v) => v,
      unit: 'W_per_m2'
    },
    'ESoil_tavg': { 
      name: 'Bare_Soil_Evaporation', 
      converter: (v) => v,
      unit: 'W_per_m2'
    },
    
    // ========================================================================
    // OTHER LAND SURFACE (3 variables)
    // ========================================================================
    'RootMoist_inst': { 
      name: 'Root_Zone_Soil_Moisture', 
      converter: (v) => v,
      unit: 'kg_per_m2'
    },
    'CanopInt_inst': { 
      name: 'Canopy_Water_Storage', 
      converter: (v) => v,
      unit: 'kg_per_m2'
    },
    'ACond_tavg': { 
      name: 'Aerodynamic_Conductance', 
      converter: (v) => v,
      unit: 'm_per_s'
    },
    
    // ========================================================================
    // FORCING VARIABLES (7 atmospheric inputs)
    // ========================================================================
    'Wind_f_inst': { 
      name: 'Wind_Speed', 
      converter: (v) => v,
      unit: 'm_per_s'
    },
    'Rainf_f_tavg': { 
      name: 'Total_Precipitation_Forcing', 
      converter: (v) => v * 3600,
      unit: 'mm_per_hour'
    },
    'Tair_f_inst': { 
      name: 'Air_Temperature', 
      converter: (v) => v - 273.15,
      unit: 'Celsius'
    },
    'Qair_f_inst': { 
      name: 'Specific_Humidity', 
      converter: (v) => v * 1000,
      unit: 'g_per_kg'
    },
    'Psurf_f_inst': { 
      name: 'Surface_Pressure', 
      converter: (v) => v / 100, // Convert Pa to hPa
      unit: 'hPa'
    },
    'SWdown_f_tavg': { 
      name: 'Downward_Shortwave_Radiation', 
      converter: (v) => v,
      unit: 'W_per_m2'
    },
    'LWdown_f_tavg': { 
      name: 'Downward_Longwave_Radiation', 
      converter: (v) => v,
      unit: 'W_per_m2'
    }
  };

  // Extract available variables from the data
  const variableNamesSet = new Set<string>();
  for (const point of data) {
    if (point.variables) {
      Object.keys(point.variables).forEach(varName => {
        variableNamesSet.add(varName);
      });
    }
  }

  const variableNames = Array.from(variableNamesSet).sort();

  console.log(`📊 Generating CSV with ${variableNames.length} variables`);
  console.log(`   Variables:`, variableNames.join(', '));

  // Create headers with human-readable names and units
  const headers = [
    "DateTime_UTC",
    "Latitude_deg",
    "Longitude_deg",
    ...variableNames.map(varName => {
      const mapping = variableMapping[varName];
      if (mapping) {
        return `${mapping.name}_${mapping.unit}`;
      }
      // Fallback for any unmapped variables
      console.warn(`   ⚠️ Unmapped variable: ${varName} - using original name`);
      return varName;
    })
  ];

  // Create data rows with unit conversions
  const rows = data.map(point => {
    const row = [
      point.timestamp.toISOString(),
      point.lat.toFixed(4),
      point.lon.toFixed(4),
      ...variableNames.map(varName => {
        const value = point.variables[varName];
        if (value === undefined || value === null || isNaN(value)) {
          return "";
        }
        
        const mapping = variableMapping[varName];
        if (mapping) {
          const convertedValue = mapping.converter(value);
          return convertedValue.toFixed(4);
        } else {
          // Fallback: return raw value
          return value.toFixed(4);
        }
      })
    ];
    return row.join(",");
  });

  const csvContent = [
    headers.join(","),
    ...rows
  ].join("\n");

  console.log(`✅ CSV generated: ${rows.length} rows × ${headers.length} columns`);
  console.log(`   Variables included: ${variableNames.length}`);

  return csvContent;
}

/**
 * Get summary statistics about the dataset before export.
 * Useful for logging and validation.
 * 
 * @param data - Array of weather data points
 * @returns Summary object with dataset statistics
 */
export function getDatasetSummary(data: WeatherDataPoint[]): {
  totalPoints: number;
  variables: string[];
  dateRange?: { start: string; end: string };
  spatialExtent?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
} {
  if (!data || data.length === 0) {
    return {
      totalPoints: 0,
      variables: []
    };
  }

  // Extract all unique variable names
  const variableNames = new Set<string>();
  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;
  let minTime = Infinity, maxTime = -Infinity;

  for (const point of data) {
    // Collect variable names
    if (point.variables) {
      Object.keys(point.variables).forEach(varName => variableNames.add(varName));
    }

    // Track spatial extent
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLon = Math.min(minLon, point.lon);
    maxLon = Math.max(maxLon, point.lon);

    // Track temporal extent
    const time = point.timestamp.getTime();
    minTime = Math.min(minTime, time);
    maxTime = Math.max(maxTime, time);
  }

  return {
    totalPoints: data.length,
    variables: Array.from(variableNames).sort(),
    dateRange: {
      start: new Date(minTime).toISOString(),
      end: new Date(maxTime).toISOString()
    },
    spatialExtent: {
      minLat,
      maxLat,
      minLon,
      maxLon
    }
  };
}
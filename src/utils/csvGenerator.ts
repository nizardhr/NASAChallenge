/**
 * ============================================================================
 * CSV GENERATOR FOR NASA GLDAS DATA
 * ============================================================================
 * 
 * PURPOSE:
 * Convert parsed weather data points into human-readable CSV format with
 * proper unit conversions and meaningful column names.
 * 
 * CHANGE LOG:
 * - Updated to include all 36 GLDAS NOAH variables
 * - Added comprehensive variable mappings and unit conversions
 * 
 * ============================================================================
 */

import { WeatherDataPoint } from './asciiParser';

/**
 * Generate human-readable CSV from weather data points.
 * This version converts NASA variable names to more user-friendly formats.
 * 
 * @param data - Array of weather data points
 * @returns CSV formatted string with converted units and readable names
 */
export function generateCSV(data: WeatherDataPoint[]): string {
  if (!data || data.length === 0) {
    console.warn("⚠️ No data to export to CSV");
    return "No data available";
  }

  // Variable name mapping and unit conversions
  const variableMapping: Record<string, { 
    name: string, 
    converter: (value: number) => number,
    unit: string 
  }> = {
    // Forcing Variables
    'Tair_f_inst': { 
      name: 'Air_Temperature', 
      converter: (v) => v - 273.15,
      unit: 'Celsius'
    },
    'Rainf_f_tavg': { 
      name: 'Total_Precipitation_Rate', 
      converter: (v) => v * 3600,
      unit: 'mm/hour'
    },
    'Qair_f_inst': { 
      name: 'Specific_Humidity', 
      converter: (v) => v * 1000,
      unit: 'g/kg'
    },
    'Wind_f_inst': { 
      name: 'Wind_Speed', 
      converter: (v) => v,
      unit: 'm/s'
    },
    'Psurf_f_inst': { 
      name: 'Surface_Pressure', 
      converter: (v) => v,
      unit: 'Pa'
    },
    'SWdown_f_tavg': { 
      name: 'Downward_Shortwave_Radiation', 
      converter: (v) => v,
      unit: 'W/m²'
    },
    'LWdown_f_tavg': { 
      name: 'Downward_Longwave_Radiation', 
      converter: (v) => v,
      unit: 'W/m²'
    },
    
    // Energy Fluxes
    'Swnet_tavg': { 
      name: 'Net_Shortwave_Radiation', 
      converter: (v) => v,
      unit: 'W/m²'
    },
    'Lwnet_tavg': { 
      name: 'Net_Longwave_Radiation', 
      converter: (v) => v,
      unit: 'W/m²'
    },
    'Qle_tavg': { 
      name: 'Latent_Heat_Flux', 
      converter: (v) => v,
      unit: 'W/m²'
    },
    'Qh_tavg': { 
      name: 'Sensible_Heat_Flux', 
      converter: (v) => v,
      unit: 'W/m²'
    },
    'Qg_tavg': { 
      name: 'Ground_Heat_Flux', 
      converter: (v) => v,
      unit: 'W/m²'
    },
    
    // Water Fluxes
    'Snowf_tavg': { 
      name: 'Snow_Precipitation_Rate', 
      converter: (v) => v * 3600,
      unit: 'mm/hour'
    },
    'Rainf_tavg': { 
      name: 'Rain_Precipitation_Rate', 
      converter: (v) => v * 3600,
      unit: 'mm/hour'
    },
    'Evap_tavg': { 
      name: 'Evapotranspiration', 
      converter: (v) => v * 3600,
      unit: 'mm/hour'
    },
    'PotEvap_tavg': { 
      name: 'Potential_Evaporation', 
      converter: (v) => v,
      unit: 'W/m²'
    },
    'ECanop_tavg': { 
      name: 'Canopy_Evaporation', 
      converter: (v) => v,
      unit: 'W/m²'
    },
    'TVeg_tavg': { 
      name: 'Transpiration', 
      converter: (v) => v,
      unit: 'W/m²'
    },
    'ESoil_tavg': { 
      name: 'Soil_Evaporation', 
      converter: (v) => v,
      unit: 'W/m²'
    },
    'CanopInt_inst': { 
      name: 'Canopy_Water_Storage', 
      converter: (v) => v,
      unit: 'kg/m²'
    },
    
    // Runoff
    'Qs_acc': { 
      name: 'Surface_Runoff', 
      converter: (v) => v,
      unit: 'kg/m²'
    },
    'Qsb_acc': { 
      name: 'Baseflow_Runoff', 
      converter: (v) => v,
      unit: 'kg/m²'
    },
    'Qsm_acc': { 
      name: 'Snow_Melt', 
      converter: (v) => v,
      unit: 'kg/m²'
    },
    
    // Snow
    'SWE_inst': { 
      name: 'Snow_Water_Equivalent', 
      converter: (v) => v,
      unit: 'kg/m²'
    },
    'SnowDepth_inst': { 
      name: 'Snow_Depth', 
      converter: (v) => v * 100,
      unit: 'cm'
    },
    
    // Soil Moisture (4 layers)
    'SoilMoi0_10cm_inst': { 
      name: 'Soil_Moisture_0-10cm', 
      converter: (v) => v,
      unit: 'kg/m²'
    },
    'SoilMoi10_40cm_inst': { 
      name: 'Soil_Moisture_10-40cm', 
      converter: (v) => v,
      unit: 'kg/m²'
    },
    'SoilMoi40_100cm_inst': { 
      name: 'Soil_Moisture_40-100cm', 
      converter: (v) => v,
      unit: 'kg/m²'
    },
    'SoilMoi100_200cm_inst': { 
      name: 'Soil_Moisture_100-200cm', 
      converter: (v) => v,
      unit: 'kg/m²'
    },
    'RootMoist_inst': { 
      name: 'Root_Zone_Soil_Moisture', 
      converter: (v) => v,
      unit: 'kg/m²'
    },
    
    // Soil Temperature (4 layers)
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
    
    // Surface
    'AvgSurfT_inst': { 
      name: 'Average_Surface_Temperature', 
      converter: (v) => v - 273.15,
      unit: 'Celsius'
    },
    'Albedo_inst': { 
      name: 'Albedo', 
      converter: (v) => v,
      unit: '%'
    }
  };

  // Extract available variables
  const variableNamesSet = new Set<string>();
  for (const point of data) {
    if (point.variables) {
      Object.keys(point.variables).forEach(varName => {
        variableNamesSet.add(varName);
      });
    }
  }

  const variableNames = Array.from(variableNamesSet).sort();

  // Create headers with units
  const headers = [
    "DateTime (UTC)",
    "Latitude (degrees)",
    "Longitude (degrees)",
    ...variableNames.map(varName => {
      const mapping = variableMapping[varName];
      if (mapping) {
        return `${mapping.name} (${mapping.unit})`;
      }
      return varName; // Use original name if no mapping exists
    })
  ];

  // Create data rows with conversions
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
        const convertedValue = mapping ? mapping.converter(value) : value;
        return convertedValue.toFixed(4);
      })
    ];
    return row.join(",");
  });

  const csvContent = [
    headers.join(","),
    ...rows
  ].join("\n");

  console.log(`✅ Human-readable CSV generated: ${rows.length} rows, ${headers.length} columns`);

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

/**
 * Download CSV file to user's computer.
 * 
 * @param csvContent - CSV formatted string
 * @param filename - Desired filename for download
 */
export function downloadCSV(csvContent: string, filename: string = 'gldas_data.csv'): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  
  console.log(`📥 CSV downloaded: ${filename}`);
}
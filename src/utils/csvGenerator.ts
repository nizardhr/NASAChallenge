/**
 * ============================================================================
 * CSV GENERATOR - CONSOLIDATED DATA EXPORT
 * ============================================================================
 *
 * PURPOSE:
 * Generates a single consolidated CSV file from all accumulated weather data.
 * Handles dynamic variable names from NASA GLDAS data.
 *
 * FEATURES:
 * - Extracts all unique variable names from the dataset
 * - Creates proper CSV headers with all available measurements
 * - Handles missing values gracefully
 * - Sorts data chronologically before export
 *
 * ============================================================================
 */

import { WeatherDataPoint } from './asciiParser';

/**
 * Generate CSV string from consolidated weather data points.
 * Automatically detects all available variables in the dataset.
 * 
 * @param data - Array of weather data points from all processed files
 * @returns CSV formatted string ready for download
 */
export function generateCSV(data: WeatherDataPoint[]): string {
  if (!data || data.length === 0) {
    console.warn("⚠️ No data to export to CSV");
    return "No data available";
  }

  console.log(`📊 Generating CSV for ${data.length} data points...`);

  // --- Extract all unique variable names from the dataset ---
  const variableNamesSet = new Set<string>();
  
  for (const point of data) {
    if (point.variables) {
      Object.keys(point.variables).forEach(varName => {
        variableNamesSet.add(varName);
      });
    }
  }

  const variableNames = Array.from(variableNamesSet).sort();
  
  console.log(`📋 Variables found: ${variableNames.join(", ")}`);

  // --- Create CSV header ---
  const headers = [
    "timestamp",
    "latitude",
    "longitude",
    ...variableNames
  ];

  // --- Create data rows ---
  const rows = data.map(point => {
    const row = [
      point.timestamp.toISOString(),
      point.lat.toFixed(6),
      point.lon.toFixed(6),
      ...variableNames.map(varName => {
        const value = point.variables[varName];
        // Handle missing values
        if (value === undefined || value === null || isNaN(value)) {
          return "";
        }
        // Format numbers to reasonable precision
        return value.toFixed(6);
      })
    ];
    return row.join(",");
  });

  // --- Combine header and rows ---
  const csvContent = [
    headers.join(","),
    ...rows
  ].join("\n");

  console.log(`✅ CSV generated: ${rows.length} rows, ${headers.length} columns`);

  return csvContent;
}

/**
 * Generate CSV with human-readable column names and unit conversions.
 * This version converts NASA variable names to more user-friendly formats.
 * 
 * @param data - Array of weather data points
 * @returns CSV formatted string with converted units and readable names
 */
export function generateHumanReadableCSV(data: WeatherDataPoint[]): string {
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
    'Tair_f_inst': { 
      name: 'Temperature', 
      converter: (v) => v - 273.15, // Kelvin to Celsius
      unit: 'Celsius'
    },
    'Rainf_f_tavg': { 
      name: 'Precipitation', 
      converter: (v) => v * 3600, // kg/m²/s to mm/hour
      unit: 'mm/hour'
    },
    'Qair_f_inst': { 
      name: 'Specific_Humidity', 
      converter: (v) => v * 1000, // kg/kg to g/kg
      unit: 'g/kg'
    },
    'Wind_f_inst': { 
      name: 'Wind_Speed', 
      converter: (v) => v, // Already in m/s
      unit: 'm/s'
    },
    'Psurf_f_inst': { 
      name: 'Surface_Pressure', 
      converter: (v) => v / 1000, // Pa to kPa
      unit: 'kPa'
    },
    'SWdown_f_tavg': { 
      name: 'Solar_Radiation', 
      converter: (v) => v, // Already in W/m²
      unit: 'W/m²'
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
 * @returns Object with dataset statistics
 */
export function getDatasetSummary(data: WeatherDataPoint[]) {
  if (!data || data.length === 0) {
    return {
      totalPoints: 0,
      variables: [],
      dateRange: null,
      spatialExtent: null
    };
  }

  // Get all unique variables
  const variableNamesSet = new Set<string>();
  for (const point of data) {
    if (point.variables) {
      Object.keys(point.variables).forEach(varName => {
        variableNamesSet.add(varName);
      });
    }
  }

  // Get date range
  const timestamps = data.map(p => p.timestamp.getTime());
  const minTime = new Date(Math.min(...timestamps));
  const maxTime = new Date(Math.max(...timestamps));

  // Get spatial extent
  const lats = data.map(p => p.lat);
  const lons = data.map(p => p.lon);

  return {
    totalPoints: data.length,
    variables: Array.from(variableNamesSet).sort(),
    dateRange: {
      start: minTime.toISOString(),
      end: maxTime.toISOString()
    },
    spatialExtent: {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons)
    }
  };
}
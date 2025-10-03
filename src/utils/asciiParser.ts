/**
 * ============================================================================
 * OPeNDAP ASCII DATA PARSER
 * ============================================================================
 *
 * PURPOSE:
 * Parses NASA OPeNDAP ASCII format data from GLDAS NetCDF files.
 * Converts them into structured WeatherDataPoint[] for accumulation.
 * Multiple files are combined in the parent component before CSV export.
 *
 * CHANGE LOG:
 * - Removed automatic per-file CSV download
 * - CSV export now happens once after all files are processed
 * - User triggers download via button click
 * - Fixed parsing to handle OPeNDAP named dimension format
 *
 * ============================================================================
 */

export interface WeatherDataPoint {
  lat: number;
  lon: number;
  timestamp: Date;
  variables: Record<string, number>; // all variables by name
}

/**
 * Utility: Extract line by regex key
 */
function findLine(lines: string[], key: string): string | undefined {
  return lines.find(line => new RegExp(`^${key}(\\[.*\\])?,`).test(line));
}

/**
 * Utility: Parse a line into an array of numbers
 */
function parseNumberArray(line: string): number[] {
  return line
    .split(",")
    .slice(1)
    .map(v => parseFloat(v))
    .filter(v => !isNaN(v));
}

/**
 * Main parser for OPeNDAP ASCII text.
 * Returns parsed data points to be accumulated with other files.
 * CSV export happens after all files are processed via user button click.
 * 
 * @param asciiText - Raw ASCII data from OPeNDAP response
 * @param userLat - User's latitude (for logging/debugging)
 * @param userLon - User's longitude (for logging/debugging)
 * @returns Array of weather data points from this file
 */
export function parseASCIIData(
  asciiText: string,
  userLat: number,
  userLon: number
): WeatherDataPoint[] {
  console.log("📄 Parsing OPeNDAP ASCII data...");
  console.log("   User location:", userLat, userLon);

  // DEBUG: Log first 500 characters of response
  console.log("   First 500 chars of response:");
  console.log(asciiText.substring(0, 500));

  const lines = asciiText.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  // --- Extract coordinates ---
  const latLine = findLine(lines, "lat");
  const lonLine = findLine(lines, "lon");
  const timeLine = findLine(lines, "time");

  if (!latLine || !lonLine || !timeLine) {
    console.error("❌ Could not find coordinate arrays");
    console.error("   Lines sample:", lines.slice(0, 20));
    throw new Error("❌ Could not find coordinate arrays (lat/lon/time) in ASCII data");
  }

  const lats = parseNumberArray(latLine);
  const lons = parseNumberArray(lonLine);
  const times = parseNumberArray(timeLine);

  console.log(`   Coordinates: ${lats.length} lats, ${lons.length} lons, ${times.length} times`);

  if (lats.length === 0 || lons.length === 0 || times.length === 0) {
    throw new Error("❌ Parsed empty coordinate arrays from ASCII data");
  }

  // --- Extract variable lines ---
  // Filter out coordinate lines, dataset header, and variable metadata lines
  const dataLines = lines.filter(
    l =>
      !/^lat/.test(l) &&
      !/^lon/.test(l) &&
      !/^time/.test(l) &&
      !/^Dataset/.test(l) &&
      // Filter out variable metadata lines (e.g., "Wind_f_inst.lon, ...")
      !/\.\w+,\s*[-\d]/.test(l)
  );

  console.log(`   Found ${dataLines.length} data lines`);

  if (dataLines.length === 0) {
    console.error("❌ No variable data found");
    console.error("   All lines:", lines);
    throw new Error("❌ No variable data found in ASCII response");
  }

  // DEBUG: Log first few data lines
  console.log("   Sample data lines:");
  dataLines.slice(0, 5).forEach(line => console.log("   ", line));

  const pointsMap: Record<string, WeatherDataPoint> = {};
  const variableNames = new Set<string>();

  for (const line of dataLines) {
    const parts = line.split(",");
    if (parts.length < 2) continue;

    // Match format: VarName.VarName[VarName.time=VALUE][VarName.lat=VALUE]
    // Example: Wind_f_inst.Wind_f_inst[Wind_f_inst.time=12362220][Wind_f_inst.lat=39.875]
    const match = parts[0].match(/^(\w+)\.\w+\[\w+\.time=(\d+)\]\[\w+\.lat=([\d.]+)\]/);
    
    if (!match) {
      console.warn("   ⚠️ Could not parse line:", line.substring(0, 100));
      continue;
    }

    const varName = match[1];
    const timeValue = parseInt(match[2]);
    const latValue = parseFloat(match[3]);

    // Parse all numeric values from the line (these correspond to longitude positions)
    const values = parts.slice(1).map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
    
    if (values.length === 0) {
      console.warn("   ⚠️ No valid values in line:", line.substring(0, 100));
      continue;
    }

    // Find the closest lat and time indices
    const latIdx = lats.findIndex(lat => Math.abs(lat - latValue) < 0.01);
    const timeIdx = times.findIndex(time => Math.abs(time - timeValue) < 1);

    if (timeIdx === -1 || latIdx === -1) {
      console.warn(`   ⚠️ Could not match lat=${latValue} time=${timeValue}`);
      continue;
    }

    // Each value corresponds to a longitude in order
    values.forEach((value, lonIdx) => {
      if (lonIdx < lons.length) {
        const key = `${timeIdx}_${latIdx}_${lonIdx}`;

        if (!pointsMap[key]) {
          pointsMap[key] = {
            lat: lats[latIdx],
            lon: lons[lonIdx],
            timestamp: new Date(times[timeIdx] * 1000),
            variables: {}
          };
        }

        pointsMap[key].variables[varName] = value;
        variableNames.add(varName);
      }
    });
  }

  const points = Object.values(pointsMap);
  console.log(`✅ Parsed ${points.length} data points, variables: ${[...variableNames].join(", ")}`);

  // --- REMOVED: Auto-export CSV ---
  // Previously, autoDownloadCSV() was called here for each file.
  // Now, CSV export happens once after all files are combined.
  // User clicks the download button to get the consolidated CSV.

  return points;
}

/**
 * Convert WeatherDataPoint[] to CSV string.
 * This function is kept for potential future use but is not called during parsing.
 * The actual CSV generation happens in csvGenerator.ts.
 * 
 * @param points - Array of weather data points
 * @param variableNames - List of variable names to include as columns
 * @returns CSV formatted string
 */
export function toCSV(points: WeatherDataPoint[], variableNames: string[]): string {
  const header = ["lat", "lon", "time", ...variableNames];
  const rows = points.map(p => {
    const row = [
      p.lat,
      p.lon,
      p.timestamp.toISOString(),
      ...variableNames.map(v => p.variables[v] ?? "")
    ];
    return row.join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

/**
 * Helper function to manually download CSV if needed.
 * This is kept as a utility but is not automatically called.
 * 
 * @param points - Array of weather data points
 * @param variableNames - List of variable names
 */
export function manualDownloadCSV(points: WeatherDataPoint[], variableNames: string[]): void {
  if (!points || points.length === 0) {
    console.warn("⚠️ No points to export to CSV");
    return;
  }

  const csvString = toCSV(points, variableNames);

  // Generate unique filename with date + time
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19); // up to seconds
  const filename = `nasa_gldas_${timestamp}.csv`;

  const blob = new Blob([csvString], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`📥 CSV manually downloaded: ${filename}`);
}
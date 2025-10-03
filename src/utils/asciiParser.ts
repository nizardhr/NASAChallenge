/**
 * ============================================================================
 * OPeNDAP ASCII DATA PARSER (Multi-variable + Auto CSV Export)
 * ============================================================================
 *
 * PURPOSE:
 * Parses NASA OPeNDAP ASCII format data from GLDAS NetCDF files.
 * Converts them into structured WeatherDataPoint[] and automatically
 * downloads a CSV file in the browser after parsing.
 *
 * Supports multiple variables (temperature, humidity, precipitation, etc.)
 * and both:
 *   lat[0], -59.875, -59.625, ...
 *   lat, -59.875, -59.625, ...
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
 * Automatically exports parsed data to CSV in the browser.
 */
export function parseASCIIData(
  asciiText: string,
  userLat: number,
  userLon: number
): WeatherDataPoint[] {
  console.log("📄 Parsing OPeNDAP ASCII data...");
  console.log("   User location:", userLat, userLon);

  const lines = asciiText.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  // --- Extract coordinates ---
  const latLine = findLine(lines, "lat");
  const lonLine = findLine(lines, "lon");
  const timeLine = findLine(lines, "time");

  if (!latLine || !lonLine || !timeLine) {
    throw new Error("❌ Could not find coordinate arrays (lat/lon/time) in ASCII data");
  }

  const lats = parseNumberArray(latLine);
  const lons = parseNumberArray(lonLine);
  const times = parseNumberArray(timeLine);

  if (lats.length === 0 || lons.length === 0 || times.length === 0) {
    throw new Error("❌ Parsed empty coordinate arrays from ASCII data");
  }

  // --- Extract variable lines ---
  const dataLines = lines.filter(
    l =>
      !/^lat/.test(l) &&
      !/^lon/.test(l) &&
      !/^time/.test(l) &&
      !/^Dataset/.test(l)
  );

  if (dataLines.length === 0) {
    throw new Error("❌ No variable data found in ASCII response");
  }

  const pointsMap: Record<string, WeatherDataPoint> = {};
  const variableNames = new Set<string>();

  for (const line of dataLines) {
    const parts = line.split(",");
    if (parts.length < 2) continue;

    const value = parseFloat(parts[1]);
    if (isNaN(value)) continue;

    // Match format: VarName[time][lat][lon]
    const match = parts[0].match(/^(\w+)\[(\d+)\]\[(\d+)\]\[(\d+)\]/);
    if (!match) continue;

    const varName = match[1];
    const timeIdx = parseInt(match[2]);
    const latIdx = parseInt(match[3]);
    const lonIdx = parseInt(match[4]);

    if (
      timeIdx < times.length &&
      latIdx < lats.length &&
      lonIdx < lons.length
    ) {
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
  }

  const points = Object.values(pointsMap);
  console.log(`✅ Parsed ${points.length} data points, variables: ${[...variableNames].join(", ")}`);

  // --- Auto-export CSV ---
  autoDownloadCSV(points, [...variableNames]);

  return points;
}

/**
 * Convert WeatherDataPoint[] to CSV string
 */
function toCSV(points: WeatherDataPoint[], variableNames: string[]): string {
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
 * Automatically download CSV in the browser.
 * Each file is saved with a unique timestamp in its name.
 */
function autoDownloadCSV(points: WeatherDataPoint[], variableNames: string[]): void {
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

  console.log(`📥 CSV auto-downloaded: ${filename}`);
}

/**
 * ============================================================================
 * DATE AND URL HELPERS FOR NASA GLDAS DATA
 * ============================================================================
 * 
 * PURPOSE:
 * Generate optimized OPeNDAP URLs with spatial subsetting to minimize
 * download time and bandwidth usage.
 * 
 * OPTIMIZATION:
 * Instead of downloading global grids (~100MB per file), we request only
 * a 3x3 grid centered on the user's location (~10KB per file).
 * 
 * ============================================================================
 */

/**
 * Get day of year (1-366)
 */
export function getDayOfYear(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  return String(day).padStart(3, '0');
}

/**
 * Format date as YYYYMMDD
 */
export function formatYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Find nearest latitude grid index
 * GLDAS grid: -60° to 90° at 0.25° resolution = 600 points
 */
function findNearestLatIndex(lat: number): number {
  // GLDAS lat range: -59.875 to 89.875 (600 points)
  const minLat = -59.875;
  const resolution = 0.25;
  const index = Math.round((lat - minLat) / resolution);
  return Math.max(0, Math.min(599, index));
}

/**
 * Find nearest longitude grid index
 * GLDAS grid: -180° to 180° at 0.25° resolution = 1440 points
 */
function findNearestLonIndex(lon: number): number {
  // GLDAS lon range: -179.875 to 179.875 (1440 points)
  const minLon = -179.875;
  const resolution = 0.25;
  const index = Math.round((lon - minLon) / resolution);
  return Math.max(0, Math.min(1439, index));
}

/**
 * Build optimized OPeNDAP URL with spatial subsetting.
 * 
 * OPTIMIZATION STRATEGY:
 * Request only a 3x3 grid window centered on user's location.
 * This reduces download size from ~100MB to ~10KB per file (1000x reduction).
 * 
 * Before: Downloads ~100MB of global data per file (60-180s)
 * After:  Downloads ~10KB of local data per file (1-5s)
 * 
 * @param date - Target date
 * @param hour - Hour of day (0, 3, 6, 9, 12, 15, 18, 21)
 * @param lat - Target latitude
 * @param lon - Target longitude
 * @returns Optimized OPeNDAP URL with spatial constraints
 */
export function buildGLDASUrl(
  date: Date, 
  hour: number, 
  lat: number, 
  lon: number
): string {
  const year = date.getFullYear();
  const doy = getDayOfYear(date);
  const dateStr = formatYYYYMMDD(date);
  const hourStr = String(hour).padStart(2, '0') + '00';
  
  // Base OPeNDAP URL
  const baseUrl = 'https://hydro1.gesdisc.eosdis.nasa.gov/opendap/GLDAS/GLDAS_NOAH025_3H.2.1';
  const filename = `GLDAS_NOAH025_3H.A${dateStr}.${hourStr}.021.nc4`;
  
  // Find nearest grid indices
  const latIndex = findNearestLatIndex(lat);
  const lonIndex = findNearestLonIndex(lon);
  
  // Create spatial window (3x3 grid points centered on target)
  // This ensures we get data even if the exact point has issues
  const latStart = Math.max(0, latIndex - 1);
  const latEnd = Math.min(599, latIndex + 1);
  const lonStart = Math.max(0, lonIndex - 1);
  const lonEnd = Math.min(1439, lonIndex + 1);
  
  // Build OPeNDAP constraint expression with spatial subsetting
  // Format: variable[time_start:time_end][lat_start:lat_end][lon_start:lon_end]
  const constraints = [
    // Forcing Variables (atmospheric inputs)
    `Tair_f_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Rainf_f_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Qair_f_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Wind_f_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Psurf_f_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `SWdown_f_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `LWdown_f_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    
    // Energy Fluxes
    `Swnet_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Lwnet_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Qle_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Qh_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Qg_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    
    // Water Fluxes
    `Snowf_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Rainf_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Evap_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `PotEvap_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `ECanop_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `TVeg_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `ESoil_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `CanopInt_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    
    // Runoff
    `Qs_acc[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Qsb_acc[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Qsm_acc[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    
    // Snow
    `SWE_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `SnowDepth_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    
    // Soil Moisture (4 layers)
    `SoilMoi0_10cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `SoilMoi10_40cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `SoilMoi40_100cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `SoilMoi100_200cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `RootMoist_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    
    // Soil Temperature (4 layers)
    `SoilTMP0_10cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `SoilTMP10_40cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `SoilTMP40_100cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `SoilTMP100_200cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    
    // Surface
    `AvgSurfT_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Albedo_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    
    // Coordinates (must be at end)
    `lat[${latStart}:${latEnd}]`,
    `lon[${lonStart}:${lonEnd}]`,
    `time[0:0]`
  ].join(',');
  
  const url = `${baseUrl}/${year}/${doy}/${filename}.ascii?${constraints}`;
  
  // Log the optimization
  console.log(`🎯 Optimized URL for (${lat}, ${lon}):`);
  console.log(`   Grid indices: lat[${latStart}:${latEnd}] lon[${lonStart}:${lonEnd}]`);
  console.log(`   Data points: ${(latEnd - latStart + 1) * (lonEnd - lonStart + 1)} (vs 864,000 global)`);
  
  return url;
}

/**
 * Generate URLs for date range with spatial optimization
 * 
 * @param startDate - Start date
 * @param endDate - End date
 * @param lat - Target latitude
 * @param lon - Target longitude
 * @returns Array of optimized OPeNDAP URLs
 */
export function getUrlsForDateRange(
  startDate: Date, 
  endDate: Date,
  lat: number,
  lon: number
): string[] {
  const urls: string[] = [];
  const current = new Date(startDate);
  
  console.log(`📅 Generating optimized URLs for ${lat}°N, ${lon}°E`);
  console.log(`   Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  
  while (current <= endDate) {
    // GLDAS has 8 files per day (every 3 hours)
    const hours = [0, 3, 6, 9, 12, 15, 18, 21];
    
    for (const hour of hours) {
      urls.push(buildGLDASUrl(new Date(current), hour, lat, lon));
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  console.log(`   Total files: ${urls.length}`);
  console.log(`   Estimated download time: ${urls.length * 2}-${urls.length * 5} seconds`);
  console.log(`   Optimization: ~${Math.round(urls.length * 0.09)}MB total (vs ~${Math.round(urls.length * 100)}MB without optimization)`);
  
  return urls;
}

/**
 * Validate coordinates are within GLDAS coverage
 */
export function validateCoordinates(lat: number, lon: number): {
  valid: boolean;
  message?: string;
} {
  if (lat < -60 || lat > 90) {
    return {
      valid: false,
      message: `Latitude ${lat}° is outside GLDAS coverage (-60° to 90°)`
    };
  }
  
  // Longitude is technically valid for all values, but normalize
  let normalizedLon = lon;
  while (normalizedLon > 180) normalizedLon -= 360;
  while (normalizedLon < -180) normalizedLon += 360;
  
  return { valid: true };
}
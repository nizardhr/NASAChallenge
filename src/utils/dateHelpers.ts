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
 * VARIABLE SELECTION:
 * Due to OPeNDAP URL length limits, we request the 25 MOST IMPORTANT variables
 * covering all major categories. This avoids HTTP 400 errors while providing
 * comprehensive weather data.
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
 * Build optimized OPeNDAP URL with 25 KEY NOAH-LSM variables.
 * 
 * VARIABLE SELECTION RATIONALE:
 * We select 25 most important variables to stay under OPeNDAP URL length limits
 * while maintaining comprehensive coverage across all data categories.
 * 
 * EXCLUDED (11 less critical variables):
 * - Lwnet_tavg (long-wave net - can derive from components)
 * - Qh_tavg (sensible heat - less commonly used)
 * - Qg_tavg (ground heat - specialized use)
 * - Qsm_acc (snow melt - can derive from snow changes)
 * - PotEvap_tavg (potential evap - less critical than actual)
 * - TVeg_tavg (transpiration - subset of evapotranspiration)
 * - SoilMoi10_40cm_inst (keep top and deep layers)
 * - SoilMoi40_100cm_inst (keep top and deep layers)
 * - SoilTMP10_40cm_inst (keep top and deep layers)
 * - SoilTMP40_100cm_inst (keep top and deep layers)
 * - RootMoist_inst (can approximate from soil layers)
 * 
 * @param date - Target date
 * @param hour - Hour of day (0, 3, 6, 9, 12, 15, 18, 21)
 * @param lat - Target latitude
 * @param lon - Target longitude
 * @returns Optimized OPeNDAP URL with 25 key variables
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
  const latStart = Math.max(0, latIndex - 1);
  const latEnd = Math.min(599, latIndex + 1);
  const lonStart = Math.max(0, lonIndex - 1);
  const lonEnd = Math.min(1439, lonIndex + 1);
  
  // Build OPeNDAP constraint with 25 MOST IMPORTANT NOAH-LSM variables
  // Carefully selected to avoid HTTP 400 errors while maintaining comprehensive coverage
  const constraints = [
    // ========================================================================
    // ENERGY FLUXES (2 most critical)
    // ========================================================================
    `Swnet_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,      // Net short wave radiation (W/m²)
    `Qle_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,        // Latent heat flux (W/m²)
    
    // ========================================================================
    // WATER FLUXES (6 most critical)
    // ========================================================================
    `Snowf_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,      // Snow precipitation rate (kg/m²/s)
    `Rainf_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,      // Rain precipitation rate (kg/m²/s)
    `Evap_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,       // Total evapotranspiration (kg/m²/s)
    `Qs_acc[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,          // Surface runoff (kg/m²)
    `Qsb_acc[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,         // Subsurface runoff (kg/m²)
    `ECanop_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,     // Canopy evaporation (W/m²)
    `ESoil_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,      // Soil evaporation (W/m²)
    
    // ========================================================================
    // SURFACE PROPERTIES (3 variables)
    // ========================================================================
    `AvgSurfT_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,   // Surface temperature (K)
    `Albedo_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,     // Surface albedo (%)
    `CanopInt_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,   // Canopy water storage (kg/m²)
    
    // ========================================================================
    // SNOW PROPERTIES (2 variables)
    // ========================================================================
    `SWE_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,        // Snow water equivalent (kg/m²)
    `SnowDepth_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,  // Snow depth (m)
    
    // ========================================================================
    // SOIL MOISTURE - KEY LAYERS (2 most important depths)
    // ========================================================================
    `SoilMoi0_10cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,    // Surface soil moisture (kg/m²)
    `SoilMoi100_200cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`, // Deep soil moisture (kg/m²)
    
    // ========================================================================
    // SOIL TEMPERATURE - KEY LAYERS (2 most important depths)
    // ========================================================================
    `SoilTMP0_10cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,    // Surface soil temp (K)
    `SoilTMP100_200cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`, // Deep soil temp (K)
    
    // ========================================================================
    // FORCING VARIABLES (7 atmospheric inputs - ALL CRITICAL)
    // ========================================================================
    `Wind_f_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,     // Wind speed (m/s)
    `Rainf_f_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,    // Total precipitation (kg/m²/s)
    `Tair_f_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,     // Air temperature (K)
    `Qair_f_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,     // Humidity (kg/kg)
    `Psurf_f_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,    // Surface pressure (Pa)
    `SWdown_f_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,   // Solar radiation down (W/m²)
    `LWdown_f_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,   // Thermal radiation down (W/m²)
    
    // ========================================================================
    // COORDINATE VARIABLES (must be at end)
    // ========================================================================
    `lat[${latStart}:${latEnd}]`,
    `lon[${lonStart}:${lonEnd}]`,
    `time[0:0]`
  ].join(',');
  
  // OPeNDAP ASCII URL format
  const url = `${baseUrl}/${year}/${doy}/${filename}.ascii?${constraints}`;
  
  console.log(`🎯 Optimized URL for (${lat}, ${lon}):`);
  console.log(`   Grid indices: lat[${latStart}:${latEnd}] lon[${lonStart}:${lonEnd}]`);
  console.log(`   Data points: ${(latEnd - latStart + 1) * (lonEnd - lonStart + 1)} (vs 864,000 global)`);
  console.log(`   Variables: 25 (optimized key variables)`);
  
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
  console.log(`   Optimization: ~${Math.round(urls.length * 0.012)}MB total (vs ~${Math.round(urls.length * 100)}MB without optimization)`);
  
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
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
 * NOAH-LSM VARIABLES:
 * All 36 variables from GLDAS Noah-LSM 3-hourly product are included.
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
 * Build optimized OPeNDAP URL with ALL 36 NOAH-LSM variables.
 * 
 * OPTIMIZATION STRATEGY:
 * Request only a 3x3 grid window centered on user's location.
 * This reduces download size from ~100MB to ~15KB per file.
 * 
 * @param date - Target date
 * @param hour - Hour of day (0, 3, 6, 9, 12, 15, 18, 21)
 * @param lat - Target latitude
 * @param lon - Target longitude
 * @returns Optimized OPeNDAP URL with spatial constraints and ALL variables
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
  
  // Build OPeNDAP constraint expression with ALL 36 NOAH-LSM variables
  // Format: variable[time_start:time_end][lat_start:lat_end][lon_start:lon_end]
  const constraints = [
    // ========================================================================
    // ENERGY FLUXES (5 variables)
    // ========================================================================
    `Swnet_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,      // Net short wave radiation flux (W/m²)
    `Lwnet_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,      // Net long-wave radiation flux (W/m²)
    `Qle_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,        // Latent heat net flux (W/m²)
    `Qh_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,         // Sensible heat net flux (W/m²)
    `Qg_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,         // Ground heat flux (W/m²)
    
    // ========================================================================
    // WATER FLUXES (9 variables)
    // ========================================================================
    `Snowf_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,      // Snow precipitation rate (kg/m²/s)
    `Rainf_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,      // Rain precipitation rate (kg/m²/s)
    `Evap_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,       // Evapotranspiration (kg/m²/s)
    `Qs_acc[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,          // Storm surface runoff (kg/m²)
    `Qsb_acc[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,         // Baseflow-groundwater runoff (kg/m²)
    `Qsm_acc[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,         // Snow melt (kg/m²)
    `PotEvap_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,    // Potential evaporation rate (W/m²)
    `ECanop_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,     // Canopy water evaporation (W/m²)
    `TVeg_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,       // Transpiration (W/m²)
    `ESoil_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,      // Direct evaporation from bare soil (W/m²)
    
    // ========================================================================
    // SURFACE PROPERTIES (3 variables)
    // ========================================================================
    `AvgSurfT_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,   // Average surface skin temperature (K)
    `Albedo_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,     // Albedo (%)
    `CanopInt_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,   // Plant canopy surface water (kg/m²)
    
    // ========================================================================
    // SNOW PROPERTIES (2 variables)
    // ========================================================================
    `SWE_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,        // Snow depth water equivalent (kg/m²)
    `SnowDepth_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,  // Snow depth (m)
    
    // ========================================================================
    // SOIL MOISTURE - 4 LAYERS (5 variables including root zone)
    // ========================================================================
    `SoilMoi0_10cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,    // Soil moisture 0-10cm (kg/m²)
    `SoilMoi10_40cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,   // Soil moisture 10-40cm (kg/m²)
    `SoilMoi40_100cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,  // Soil moisture 40-100cm (kg/m²)
    `SoilMoi100_200cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`, // Soil moisture 100-200cm (kg/m²)
    `RootMoist_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,        // Root zone soil moisture (kg/m²)
    
    // ========================================================================
    // SOIL TEMPERATURE - 4 LAYERS (4 variables)
    // ========================================================================
    `SoilTMP0_10cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,    // Soil temperature 0-10cm (K)
    `SoilTMP10_40cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,   // Soil temperature 10-40cm (K)
    `SoilTMP40_100cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,  // Soil temperature 40-100cm (K)
    `SoilTMP100_200cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`, // Soil temperature 100-200cm (K)
    
    // ========================================================================
    // FORCING VARIABLES (7 variables) - Atmospheric Inputs
    // ========================================================================
    `Wind_f_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,     // Wind speed (m/s)
    `Rainf_f_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,    // Total precipitation rate (kg/m²/s)
    `Tair_f_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,     // Air temperature (K)
    `Qair_f_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,     // Specific humidity (kg/kg)
    `Psurf_f_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,    // Surface pressure (Pa)
    `SWdown_f_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,   // Downward short-wave radiation flux (W/m²)
    `LWdown_f_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,   // Downward long-wave radiation flux (W/m²)
    
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
  console.log(`   Variables: 36 (ALL Noah-LSM parameters)`);
  
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
  console.log(`   Optimization: ~${Math.round(urls.length * 0.015)}MB total (vs ~${Math.round(urls.length * 100)}MB without optimization)`);
  
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
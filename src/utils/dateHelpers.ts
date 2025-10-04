/**
 * ============================================================================
 * DATE AND URL HELPERS FOR NASA GLDAS DATA
 * ============================================================================
 * 
 * SUPPORTS TWO FORMATS:
 * 1. ASCII (.ascii) - Limited to ~13-19 variables, human-readable text
 * 2. Binary NetCDF (.dods) - ALL 36 variables, efficient binary format
 * 
 * GLDAS NOAH 36 VARIABLES (Complete List):
 * Energy: Swnet_tavg, Lwnet_tavg, Qle_tavg, Qh_tavg, Qg_tavg
 * Water: Snowf_tavg, Rainf_tavg, Evap_tavg, Qs_acc, Qsb_acc, Qsm_acc
 * Surface: AvgSurfT_inst, Albedo_inst, SWE_inst, SnowDepth_inst
 * Soil Moisture: SoilMoi0_10cm_inst, SoilMoi10_40cm_inst, 
 *                SoilMoi40_100cm_inst, SoilMoi100_200cm_inst
 * Soil Temperature: SoilTMP0_10cm_inst, SoilTMP10_40cm_inst,
 *                   SoilTMP40_100cm_inst, SoilTMP100_200cm_inst
 * Evaporation: PotEvap_tavg, ECanop_tavg, TVeg_tavg, ESoil_tavg
 * Other: RootMoist_inst, CanopInt_inst, ACond_tavg
 * Forcing: Wind_f_inst, Rainf_f_tavg, Tair_f_inst, Qair_f_inst,
 *          Psurf_f_inst, SWdown_f_tavg, LWdown_f_tavg
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
  const minLon = -179.875;
  const resolution = 0.25;
  const index = Math.round((lon - minLon) / resolution);
  return Math.max(0, Math.min(1439, index));
}

// ============================================================================
// BINARY NETCDF-4 FORMAT (DODS) - ALL 36 VARIABLES
// ============================================================================

/**
 * Build OPeNDAP URL for DODS binary format (NetCDF-4)
 * This provides access to ALL 36 GLDAS NOAH variables
 * 
 * Format: .nc4.dods instead of .nc4.ascii
 */
export function buildGLDASUrlBinary(
  date: Date,
  hour: number,
  lat: number,
  lon: number
): string {
  const year = date.getFullYear();
  const doy = getDayOfYear(date);
  const dateStr = formatYYYYMMDD(date);
  const hourStr = String(hour).padStart(2, '0') + '00';
  
  const baseUrl = 'https://hydro1.gesdisc.eosdis.nasa.gov/opendap/GLDAS/GLDAS_NOAH025_3H.2.1';
  const filename = `GLDAS_NOAH025_3H.A${dateStr}.${hourStr}.021.nc4`;
  
  const latIndex = findNearestLatIndex(lat);
  const lonIndex = findNearestLonIndex(lon);
  
  const latStart = Math.max(0, latIndex - 1);
  const latEnd = Math.min(599, latIndex + 1);
  const lonStart = Math.max(0, lonIndex - 1);
  const lonEnd = Math.min(1439, lonIndex + 1);
  
  // ALL 36 GLDAS NOAH VARIABLES (complete list from official documentation)
  const constraints = [
    // ========================================================================
    // ENERGY FLUXES (5 variables)
    // ========================================================================
    `Swnet_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,      // Net shortwave radiation (W/m²)
    `Lwnet_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,      // Net longwave radiation (W/m²)
    `Qle_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,        // Latent heat flux (W/m²)
    `Qh_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,         // Sensible heat flux (W/m²)
    `Qg_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,         // Ground heat flux (W/m²)
    
    // ========================================================================
    // WATER BALANCE (6 variables)
    // ========================================================================
    `Snowf_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,      // Snow precipitation rate (kg/m²/s)
    `Rainf_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,      // Rain precipitation rate (kg/m²/s)
    `Evap_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,       // Evapotranspiration (kg/m²/s)
    `Qs_acc[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,          // Surface runoff (kg/m²)
    `Qsb_acc[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,         // Subsurface runoff (kg/m²)
    `Qsm_acc[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,         // Snow melt (kg/m²)
    
    // ========================================================================
    // SURFACE PROPERTIES (4 variables)
    // ========================================================================
    `AvgSurfT_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,   // Surface skin temperature (K)
    `Albedo_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,     // Albedo (%)
    `SWE_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,        // Snow water equivalent (kg/m²)
    `SnowDepth_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,  // Snow depth (m)
    
    // ========================================================================
    // SOIL MOISTURE (4 layers)
    // ========================================================================
    `SoilMoi0_10cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,    // 0-10cm soil moisture (kg/m²)
    `SoilMoi10_40cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,   // 10-40cm soil moisture (kg/m²)
    `SoilMoi40_100cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,  // 40-100cm soil moisture (kg/m²)
    `SoilMoi100_200cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`, // 100-200cm soil moisture (kg/m²)
    
    // ========================================================================
    // SOIL TEMPERATURE (4 layers)
    // ========================================================================
    `SoilTMP0_10cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,    // 0-10cm soil temp (K)
    `SoilTMP10_40cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,   // 10-40cm soil temp (K)
    `SoilTMP40_100cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,  // 40-100cm soil temp (K)
    `SoilTMP100_200cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`, // 100-200cm soil temp (K)
    
    // ========================================================================
    // EVAPORATION COMPONENTS (4 variables)
    // ========================================================================
    `PotEvap_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,    // Potential evaporation (W/m²)
    `ECanop_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,     // Canopy evaporation (W/m²)
    `TVeg_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,       // Transpiration (W/m²)
    `ESoil_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,      // Bare soil evaporation (W/m²)
    
    // ========================================================================
    // OTHER LAND SURFACE (3 variables)
    // ========================================================================
    `RootMoist_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,  // Root zone soil moisture (kg/m²)
    `CanopInt_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,   // Canopy water storage (kg/m²)
    `ACond_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,      // Aerodynamic conductance (m/s)
    
    // ========================================================================
    // FORCING VARIABLES (7 atmospheric inputs)
    // ========================================================================
    `Wind_f_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,     // Wind speed (m/s)
    `Rainf_f_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,    // Total precipitation forcing (kg/m²/s)
    `Tair_f_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,     // Air temperature (K)
    `Qair_f_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,     // Specific humidity (kg/kg)
    `Psurf_f_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,    // Surface pressure (Pa)
    `SWdown_f_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,   // Downward shortwave radiation (W/m²)
    `LWdown_f_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,   // Downward longwave radiation (W/m²)
    
    // ========================================================================
    // COORDINATES (must be at end)
    // ========================================================================
    `lat[${latStart}:${latEnd}]`,
    `lon[${lonStart}:${lonEnd}]`,
    `time[0:0]`
  ].join(',');
  
  // CRITICAL: Use .dods extension for binary NetCDF format
  const url = `${baseUrl}/${year}/${doy}/${filename}.dods?${constraints}`;
  
  console.log(`🎯 Binary NetCDF URL for (${lat}, ${lon}):`);
  console.log(`   Format: DODS binary (NetCDF-4)`);
  console.log(`   Variables: 36 (ALL GLDAS NOAH variables)`);
  console.log(`   Grid: ${(latEnd - latStart + 1)} × ${(lonEnd - lonStart + 1)} points`);
  
  return url;
}

/**
 * Generate binary format URLs for date range
 */
export function getUrlsForDateRangeBinary(
  startDate: Date,
  endDate: Date,
  lat: number,
  lon: number
): string[] {
  const urls: string[] = [];
  const current = new Date(startDate);
  
  console.log(`📅 Generating binary NetCDF URLs for ${lat}°N, ${lon}°E`);
  console.log(`   Format: DODS binary (all 36 variables)`);
  console.log(`   Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  
  while (current <= endDate) {
    const hours = [0, 3, 6, 9, 12, 15, 18, 21]; // 3-hourly data
    
    for (const hour of hours) {
      urls.push(buildGLDASUrlBinary(new Date(current), hour, lat, lon));
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  console.log(`   Total files: ${urls.length}`);
  console.log(`   Estimated download time: ${urls.length * 2}-${urls.length * 5} seconds`);
  
  return urls;
}

// ============================================================================
// ASCII FORMAT (LEGACY) - LIMITED VARIABLES
// ============================================================================

/**
 * Build OPeNDAP URL with ASCII format (limited to ~13-19 variables)
 * LEGACY: Keep for backwards compatibility and testing
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
  
  const baseUrl = 'https://hydro1.gesdisc.eosdis.nasa.gov/opendap/GLDAS/GLDAS_NOAH025_3H.2.1';
  const filename = `GLDAS_NOAH025_3H.A${dateStr}.${hourStr}.021.nc4`;
  
  const latIndex = findNearestLatIndex(lat);
  const lonIndex = findNearestLonIndex(lon);
  
  const latStart = Math.max(0, latIndex - 1);
  const latEnd = Math.min(599, latIndex + 1);
  const lonStart = Math.max(0, lonIndex - 1);
  const lonEnd = Math.min(1439, lonIndex + 1);
  
  // LIMITED VARIABLES (ASCII format only returns subset)
  const constraints = [
    `Swnet_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Rainf_f_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `SWdown_f_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Qle_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Qh_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Lwnet_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Snowf_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Rainf_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Evap_tavg[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Qs_acc[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Qsb_acc[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Qsm_acc[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `AvgSurfT_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `Albedo_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `SWE_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `SnowDepth_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `SoilMoi0_10cm_inst[0:0][${latStart}:${latEnd}][${lonStart}:${lonEnd}]`,
    `lat[${latStart}:${latEnd}]`,
    `lon[${lonStart}:${lonEnd}]`,
    `time[0:0]`
  ].join(',');
  
  // ASCII format
  const url = `${baseUrl}/${year}/${doy}/${filename}.ascii?${constraints}`;
  
  console.log(`🎯 ASCII URL for (${lat}, ${lon}):`);
  console.log(`   Format: ASCII text (limited variables)`);
  console.log(`   Variables: ~13-19 (subset only)`);
  
  return url;
}

/**
 * Generate ASCII URLs for date range (legacy)
 */
export function getUrlsForDateRange(
  startDate: Date, 
  endDate: Date,
  lat: number,
  lon: number
): string[] {
  const urls: string[] = [];
  const current = new Date(startDate);
  
  console.log(`📅 Generating ASCII URLs for ${lat}°N, ${lon}°E`);
  console.log(`   Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  
  while (current <= endDate) {
    const hours = [0, 3, 6, 9, 12, 15, 18, 21];
    
    for (const hour of hours) {
      urls.push(buildGLDASUrl(new Date(current), hour, lat, lon));
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  console.log(`   Total files: ${urls.length}`);
  
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
  
  let normalizedLon = lon;
  while (normalizedLon > 180) normalizedLon -= 360;
  while (normalizedLon < -180) normalizedLon += 360;
  
  return { valid: true };
}
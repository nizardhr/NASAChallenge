export function getDayOfYear(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  return day.toString().padStart(3, '0');
}

export function formatYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function buildGLDASUrl(date: Date, hour: number): string {
  const year = date.getFullYear();
  const doy = getDayOfYear(date);
  const dateStr = formatYYYYMMDD(date);
  const hourStr = String(hour).padStart(2, '0') + '00';
  
  const filename = `GLDAS_NOAH025_3H.A${dateStr}.${hourStr}.021.nc4`;
  
  return `https://hydro1.gesdisc.eosdis.nasa.gov/data/GLDAS/GLDAS_NOAH025_3H.2.1/${year}/${doy}/${filename}`;
}

export function getUrlsForDateRange(startDate: Date, endDate: Date): string[] {
  const urls: string[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    // GLDAS has 8 files per day (every 3 hours)
    const hours = [0, 3, 6, 9, 12, 15, 18, 21];
    
    for (const hour of hours) {
      urls.push(buildGLDASUrl(new Date(current), hour));
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return urls;
}
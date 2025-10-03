import { WeatherDataPoint } from './netcdfParser';

export function generateCSV(data: WeatherDataPoint[]): string {
  const headers = [
    'DateTime',
    'Temperature_C',
    'Precipitation_mm_per_hr',
    'Humidity_percent',
    'Wind_Speed_m_per_s'
  ];

  const rows = data.map(point => [
    point.timestamp.toISOString(),
    point.temperature.toFixed(2),
    point.precipitation.toFixed(2),
    point.humidity.toFixed(2),
    point.windSpeed.toFixed(2)
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
}
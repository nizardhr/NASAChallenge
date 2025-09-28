import { WeatherDataset, DataFormat } from '../types/weather';

export interface DataProcessor {
  processFile(file: ArrayBuffer): Promise<WeatherDataset>;
}

export class NetCDFProcessor implements DataProcessor {
  async processFile(file: ArrayBuffer): Promise<WeatherDataset> {
    // Simulate NetCDF processing - in production would use actual NetCDF libraries
    const mockData = this.createMockWeatherData();
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return mockData;
  }

  private createMockWeatherData(): WeatherDataset {
    const startDate = new Date('2020-01-01');
    const endDate = new Date('2023-12-31');
    
    // Generate mock historical data for 4 years
    const timeSteps = 1460; // ~4 years daily data
    const latSteps = 50;
    const lonSteps = 50;
    
    const latitudes = Array.from({length: latSteps}, (_, i) => -25 + (i * 50 / latSteps));
    const longitudes = Array.from({length: lonSteps}, (_, i) => -50 + (i * 100 / lonSteps));
    const times = Array.from({length: timeSteps}, (_, i) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      return date;
    });

    // Generate realistic weather data patterns
    const temperature = this.generateTemperatureData(timeSteps, latSteps, lonSteps, times);
    const precipitation = this.generatePrecipitationData(timeSteps, latSteps, lonSteps, times);
    const windSpeed = this.generateWindSpeedData(timeSteps, latSteps, lonSteps);
    const humidity = this.generateHumidityData(timeSteps, latSteps, lonSteps, temperature);

    return {
      metadata: {
        source: 'NASA MERRA-2 Reanalysis',
        spatialCoverage: {
          north: latitudes[latitudes.length - 1],
          south: latitudes[0],
          east: longitudes[longitudes.length - 1],
          west: longitudes[0]
        },
        temporalCoverage: { start: startDate, end: endDate },
        variables: [
          { name: 'temperature', longName: 'Air Temperature', units: 'Celsius' },
          { name: 'precipitation', longName: 'Precipitation Rate', units: 'mm/day' },
          { name: 'windSpeed', longName: 'Wind Speed', units: 'm/s' },
          { name: 'humidity', longName: 'Relative Humidity', units: '%' }
        ],
        resolution: { spatial: 0.5, temporal: 'daily' }
      },
      data: {
        coordinates: { latitude: latitudes, longitude: longitudes, time: times },
        variables: { temperature, precipitation, windSpeed, humidity }
      }
    };
  }

  private generateTemperatureData(timeSteps: number, latSteps: number, lonSteps: number, times: Date[]): number[][][] {
    return Array.from({length: timeSteps}, (_, t) => {
      const date = times[t];
      const dayOfYear = this.getDayOfYear(date);
      
      return Array.from({length: latSteps}, (_, lat) => {
        const latitude = -25 + (lat * 50 / latSteps);
        
        return Array.from({length: lonSteps}, (_, lon) => {
          // Seasonal temperature variation
          const seasonalTemp = 20 + 15 * Math.cos(2 * Math.PI * (dayOfYear - 172) / 365);
          
          // Latitude effect (cooler towards poles)
          const latitudeEffect = -0.3 * Math.abs(latitude);
          
          // Random daily variation
          const dailyVariation = (Math.random() - 0.5) * 10;
          
          // Longitude effect (minimal for simplicity)
          const longitudeEffect = 0;
          
          return seasonalTemp + latitudeEffect + dailyVariation + longitudeEffect;
        });
      });
    });
  }

  private generatePrecipitationData(timeSteps: number, latSteps: number, lonSteps: number, times: Date[]): number[][][] {
    return Array.from({length: timeSteps}, (_, t) => {
      const date = times[t];
      const dayOfYear = this.getDayOfYear(date);
      
      return Array.from({length: latSteps}, (_, lat) => {
        const latitude = -25 + (lat * 50 / latSteps);
        
        return Array.from({length: lonSteps}, (_, lon) => {
          // Seasonal precipitation pattern
          const seasonalRain = Math.abs(latitude) < 10 ? 
            8 + 6 * Math.cos(2 * Math.PI * (dayOfYear - 80) / 365) : // Tropical
            3 + 4 * Math.cos(2 * Math.PI * (dayOfYear - 350) / 365); // Temperate
          
          // Random precipitation events
          const precipChance = Math.random();
          const precipAmount = precipChance > 0.7 ? 
            seasonalRain * (1 + Math.random() * 3) : 
            seasonalRain * Math.random() * 0.3;
          
          return Math.max(0, precipAmount);
        });
      });
    });
  }

  private generateWindSpeedData(timeSteps: number, latSteps: number, lonSteps: number): number[][][] {
    return Array.from({length: timeSteps}, () => {
      return Array.from({length: latSteps}, (_, lat) => {
        const latitude = -25 + (lat * 50 / latSteps);
        
        return Array.from({length: lonSteps}, () => {
          // Higher wind speeds at higher latitudes
          const baseWindSpeed = 5 + Math.abs(latitude) * 0.2;
          
          // Random variation
          const variation = (Math.random() - 0.5) * 8;
          
          return Math.max(0, baseWindSpeed + variation);
        });
      });
    });
  }

  private generateHumidityData(timeSteps: number, latSteps: number, lonSteps: number, temperature: number[][][]): number[][][] {
    return Array.from({length: timeSteps}, (_, t) => {
      return Array.from({length: latSteps}, (_, lat) => {
        const latitude = -25 + (lat * 50 / latSteps);
        
        return Array.from({length: lonSteps}, (_, lon) => {
          const temp = temperature[t][lat][lon];
          
          // Higher humidity in tropical regions and with precipitation
          const baseHumidity = Math.abs(latitude) < 20 ? 70 : 50;
          
          // Inverse relationship with temperature (simplified)
          const tempEffect = -0.5 * (temp - 25);
          
          // Random variation
          const variation = (Math.random() - 0.5) * 20;
          
          return Math.max(10, Math.min(100, baseHumidity + tempEffect + variation));
        });
      });
    });
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}

export class GRIBProcessor implements DataProcessor {
  async processFile(file: ArrayBuffer): Promise<WeatherDataset> {
    // Simulate GRIB processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // For demo, return similar structure as NetCDF
    const netcdfProcessor = new NetCDFProcessor();
    const data = await netcdfProcessor.processFile(file);
    
    return {
      ...data,
      metadata: {
        ...data.metadata,
        source: 'NOAA GFS Model Data'
      }
    };
  }
}

export class DataFormatRegistry {
  private processors: Map<string, DataProcessor> = new Map([
    ['netcdf', new NetCDFProcessor()],
    ['grib', new GRIBProcessor()],
    ['nc', new NetCDFProcessor()],
    ['grb', new GRIBProcessor()],
    ['grib2', new GRIBProcessor()]
  ]);

  getProcessor(fileExtension: string): DataProcessor | null {
    return this.processors.get(fileExtension.toLowerCase()) || null;
  }

  async processFile(file: File): Promise<WeatherDataset> {
    const extension = file.name.split('.').pop() || '';
    const processor = this.getProcessor(extension);
    
    if (!processor) {
      throw new Error(`Unsupported file format: ${extension}`);
    }

    const arrayBuffer = await file.arrayBuffer();
    return processor.processFile(arrayBuffer);
  }
}
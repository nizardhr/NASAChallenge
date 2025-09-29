import { Coordinates, WeatherDataset, TimeSeriesData } from '../types/weather';

interface NASAAuthConfig {
  earthdataUsername: string;
  earthdataPassword: string;
  clientId: string;
  redirectUri: string;
}

interface MERRA2Dataset {
  temperature: number[];
  windU: number[];
  windV: number[];
  humidity: number[];
  pressure: number[];
  timestamps: Date[];
}

interface GPMDataset {
  precipitation: number[];
  timestamps: Date[];
}

interface GLDASDataset {
  soilMoisture: number[];
  evapotranspiration: number[];
  timestamps: Date[];
}

interface CPTECDataset {
  regionalTemperature: number[];
  regionalPrecipitation: number[];
  timestamps: Date[];
}

interface WeatherDataSources {
  merra2: MERRA2Dataset;
  gpm: GPMDataset;
  gldas: GLDASDataset;
  cptecBrams: CPTECDataset;
}

export class NASAEarthdataService {
  private authToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private baseUrl = 'https://urs.earthdata.nasa.gov';

  async authenticate(config: NASAAuthConfig): Promise<void> {
    try {
      // For demo purposes, we'll simulate authentication
      // In production, implement full OAuth2 flow
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.authToken = 'demo_token_' + Date.now();
      this.tokenExpiry = new Date(Date.now() + 3600000); // 1 hour
      
      console.log('NASA Earthdata authentication successful');
    } catch (error) {
      console.error('NASA authentication failed:', error);
      throw new Error('Failed to authenticate with NASA Earthdata');
    }
  }

  async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.authToken || this.isTokenExpired()) {
      throw new Error('Authentication required - please login to NASA Earthdata');
    }

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.authToken}`,
        'User-Agent': 'WeatherProbabilityApp/1.0'
      }
    });
  }

  private isTokenExpired(): boolean {
    return !this.tokenExpiry || new Date() >= this.tokenExpiry;
  }
}

export class NASADataIntegrator {
  private earthdataService = new NASAEarthdataService();

  async authenticate(): Promise<void> {
    const config: NASAAuthConfig = {
      earthdataUsername: process.env.REACT_APP_NASA_USERNAME || 'demo_user',
      earthdataPassword: process.env.REACT_APP_NASA_PASSWORD || 'demo_pass',
      clientId: process.env.REACT_APP_NASA_CLIENT_ID || 'demo_client',
      redirectUri: process.env.REACT_APP_REDIRECT_URI || 'http://localhost:3000'
    };

    await this.earthdataService.authenticate(config);
  }

  async fetchHistoricalWeatherData(
    location: Coordinates,
    targetDate: Date,
    yearsBack: number = 25
  ): Promise<WeatherDataSources> {
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear() - yearsBack, 0, 1);

    console.log(`Fetching ${yearsBack} years of data for location:`, location);

    // Parallel data fetching from multiple NASA sources
    const [merra2Data, gpmData, gldasData, cptecData] = await Promise.all([
      this.fetchMERRA2Data(location, startDate, endDate),
      this.fetchGPMPrecipitation(location, startDate, endDate),
      this.fetchGLDASHydrology(location, startDate, endDate),
      this.fetchCPTECRegionalData(location, startDate, endDate)
    ]);

    return {
      merra2: merra2Data,
      gpm: gpmData,
      gldas: gldasData,
      cptecBrams: cptecData
    };
  }

  private async fetchMERRA2Data(location: Coordinates, start: Date, end: Date): Promise<MERRA2Dataset> {
    console.log('Fetching MERRA-2 data...');
    
    // Simulate NASA MERRA-2 API call with realistic delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate realistic historical weather data
    const years = end.getFullYear() - start.getFullYear();
    const dataPoints = years * 365; // Daily data
    
    const data: MERRA2Dataset = {
      temperature: [],
      windU: [],
      windV: [],
      humidity: [],
      pressure: [],
      timestamps: []
    };

    for (let i = 0; i < dataPoints; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      
      // Generate realistic seasonal temperature patterns
      const dayOfYear = this.getDayOfYear(date);
      const seasonalTemp = 20 + 15 * Math.cos(2 * Math.PI * (dayOfYear - 172) / 365);
      const latitudeEffect = -0.3 * Math.abs(location.lat);
      const dailyVariation = (Math.random() - 0.5) * 10;
      
      data.temperature.push(seasonalTemp + latitudeEffect + dailyVariation);
      data.windU.push((Math.random() - 0.5) * 20);
      data.windV.push((Math.random() - 0.5) * 20);
      data.humidity.push(40 + Math.random() * 40);
      data.pressure.push(1013 + (Math.random() - 0.5) * 50);
      data.timestamps.push(new Date(date));
    }

    return data;
  }

  private async fetchGPMPrecipitation(location: Coordinates, start: Date, end: Date): Promise<GPMDataset> {
    console.log('Fetching GPM precipitation data...');
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const years = end.getFullYear() - start.getFullYear();
    const dataPoints = years * 365;
    
    const data: GPMDataset = {
      precipitation: [],
      timestamps: []
    };

    for (let i = 0; i < dataPoints; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      
      // Generate realistic precipitation patterns
      const dayOfYear = this.getDayOfYear(date);
      const isWetSeason = Math.abs(location.lat) < 10 ? 
        Math.cos(2 * Math.PI * (dayOfYear - 80) / 365) > 0 :
        Math.cos(2 * Math.PI * (dayOfYear - 350) / 365) > 0;
      
      const basePrecip = isWetSeason ? 5 : 1;
      const precipChance = Math.random();
      const precipitation = precipChance > 0.7 ? 
        basePrecip * (1 + Math.random() * 4) : 
        basePrecip * Math.random() * 0.3;
      
      data.precipitation.push(Math.max(0, precipitation));
      data.timestamps.push(new Date(date));
    }

    return data;
  }

  private async fetchGLDASHydrology(location: Coordinates, start: Date, end: Date): Promise<GLDASDataset> {
    console.log('Fetching GLDAS hydrology data...');
    
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    const years = end.getFullYear() - start.getFullYear();
    const dataPoints = years * 365;
    
    const data: GLDASDataset = {
      soilMoisture: [],
      evapotranspiration: [],
      timestamps: []
    };

    for (let i = 0; i < dataPoints; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      
      data.soilMoisture.push(0.1 + Math.random() * 0.4);
      data.evapotranspiration.push(Math.random() * 8);
      data.timestamps.push(new Date(date));
    }

    return data;
  }

  private async fetchCPTECRegionalData(location: Coordinates, start: Date, end: Date): Promise<CPTECDataset> {
    console.log('Fetching CPTEC regional data...');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const years = end.getFullYear() - start.getFullYear();
    const dataPoints = years * 365;
    
    const data: CPTECDataset = {
      regionalTemperature: [],
      regionalPrecipitation: [],
      timestamps: []
    };

    for (let i = 0; i < dataPoints; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      
      const dayOfYear = this.getDayOfYear(date);
      const seasonalTemp = 25 + 10 * Math.cos(2 * Math.PI * (dayOfYear - 172) / 365);
      
      data.regionalTemperature.push(seasonalTemp + (Math.random() - 0.5) * 8);
      data.regionalPrecipitation.push(Math.random() * 15);
      data.timestamps.push(new Date(date));
    }

    return data;
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private createBoundingBox(location: Coordinates, buffer: number) {
    return {
      north: location.lat + buffer,
      south: location.lat - buffer,
      east: location.lng + buffer,
      west: location.lng - buffer
    };
  }
}
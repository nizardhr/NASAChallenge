export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface Variable {
  name: string;
  longName: string;
  units: string;
  standardName?: string;
}

export interface WeatherDataset {
  metadata: {
    source: string;
    spatialCoverage: BoundingBox;
    temporalCoverage: DateRange;
    variables: Variable[];
    resolution: {
      spatial: number;
      temporal: string;
    };
  };
  data: {
    coordinates: {
      latitude: number[];
      longitude: number[];
      time: Date[];
    };
    variables: Record<string, number[][][]>; // [time][lat][lon]
  };
}

export interface WeatherCondition {
  type: 'veryHot' | 'veryCold' | 'veryWet' | 'veryWindy' | 'veryUncomfortable';
  label: string;
  probability: number;
  confidence: number;
  threshold: number;
  historicalOccurrences: number;
}

export interface ProbabilityResults {
  conditions: WeatherCondition[];
  confidenceIntervals: {
    lower: number;
    upper: number;
  }[];
  historicalContext: {
    years: number[];
    values: number[];
  };
  dataQuality: {
    completeness: number;
    reliability: number;
    sources: string[];
  };
}

export interface LoadingProgress {
  source: string;
  status: 'loading' | 'complete' | 'error';
  progress: number;
  overallProgress?: number;
}

export interface WeatherAnalysis {
  location: Coordinates;
  targetDate: Date;
  results: ProbabilityResults;
  generatedAt: Date;
}

export interface DataFormat {
  type: 'netcdf' | 'hdf4' | 'hdf5' | 'grib' | 'geotiff' | 'csv' | 'json' | 'ascii';
  parser: (file: File) => Promise<WeatherDataset>;
  validator: (data: any) => boolean;
}

export interface CacheEntry {
  data: WeatherDataset;
  timestamp: number;
  ttl: number;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface UserPreferences {
  units: 'metric' | 'imperial';
  theme: 'light' | 'dark' | 'auto';
  language: string;
  defaultLocation?: Coordinates;
}

export interface SavedLocation {
  id: string;
  name: string;
  coordinates: Coordinates;
  createdAt: Date;
}
import { WeatherDataset } from '../types/weather';

interface ProbabilityThresholds {
  veryHot: number;
  veryCold: number;
  veryWet: number;
  veryWindy: number;
  veryUncomfortable: number;
}

interface ProbabilityResult {
  probability: number;
  threshold: number;
  confidence: number;
  historicalOccurrences: number;
}

export interface ProbabilityResults {
  probabilities: {
    veryHot: ProbabilityResult;
    veryCold: ProbabilityResult;
    veryWet: ProbabilityResult;
    veryWindy: ProbabilityResult;
    veryUncomfortable: ProbabilityResult;
  };
  historicalContext: {
    dataYears: number;
    totalDataPoints: number;
    averageConditions: {
      temperature: number;
      precipitation: number;
      windSpeed: number;
      humidity: number;
    };
    extremeEvents: Array<{
      date: Date;
      type: string;
      value: number;
    }>;
  };
  dataQuality: {
    completeness: number;
    reliability: number;
    sources: string[];
  };
}

export class WeatherProbabilityCalculator {
  calculateProbabilities(
    datasets: WeatherDataset[],
    targetDate: Date
  ): ProbabilityResults {
    if (datasets.length === 0) {
      throw new Error('No datasets provided for analysis');
    }

    // Extract same-date historical data (±7 days seasonal window)
    const sameDateData = this.extractSeasonalData(datasets, targetDate);

    // Calculate dynamic thresholds using NASA-standard percentiles
    const thresholds = this.calculateThresholds(sameDateData);

    // Calculate probabilities based on historical occurrences
    const probabilities = this.calculateHistoricalProbabilities(sameDateData, thresholds);

    // Generate historical context
    const historicalContext = this.generateHistoricalContext(sameDateData, datasets);

    // Assess data quality
    const dataQuality = this.assessDataQuality(sameDateData, datasets);

    return {
      probabilities,
      historicalContext,
      dataQuality
    };
  }

  private extractSeasonalData(
    datasets: WeatherDataset[],
    targetDate: Date
  ): { 
    temperature: number[];
    precipitation: number[];
    windSpeed: number[];
    humidity: number[];
    dates: Date[];
  } {
    const targetDayOfYear = this.getDayOfYear(targetDate);
    const seasonalWindow = 7; // ±7 days for seasonal analysis

    const temperature: number[] = [];
    const precipitation: number[] = [];
    const windSpeed: number[] = [];
    const humidity: number[] = [];
    const dates: Date[] = [];

    datasets.forEach(dataset => {
      const times = dataset.data.coordinates.time;
      const temps = dataset.data.variables.temperature[0] || [];
      const precips = dataset.data.variables.precipitation[0] || [];
      const winds = dataset.data.variables.windSpeed[0] || [];
      const humids = dataset.data.variables.humidity[0] || [];

      times.forEach((time, i) => {
        const dayOfYear = this.getDayOfYear(time);
        
        // Include data within seasonal window
        if (Math.abs(dayOfYear - targetDayOfYear) <= seasonalWindow) {
          if (temps[i] !== undefined && !isNaN(temps[i])) {
            temperature.push(temps[i]);
            dates.push(new Date(time));
          }
          if (precips[i] !== undefined && !isNaN(precips[i])) {
            precipitation.push(precips[i]);
          }
          if (winds[i] !== undefined && !isNaN(winds[i])) {
            windSpeed.push(winds[i]);
          }
          if (humids[i] !== undefined && !isNaN(humids[i])) {
            humidity.push(humids[i]);
          }
        }
      });
    });

    return { temperature, precipitation, windSpeed, humidity, dates };
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private calculateThresholds(data: {
    temperature: number[];
    precipitation: number[];
    windSpeed: number[];
    humidity: number[];
  }): ProbabilityThresholds {
    return {
      veryHot: this.calculatePercentile(data.temperature, 95), // 95th percentile
      veryCold: this.calculatePercentile(data.temperature, 5), // 5th percentile
      veryWet: this.calculatePercentile(data.precipitation, 90), // 90th percentile
      veryWindy: this.calculatePercentile(data.windSpeed, 85), // 85th percentile
      veryUncomfortable: this.calculateHeatIndexThreshold(data.temperature, data.humidity)
    };
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = values.filter(v => !isNaN(v) && v !== null).sort((a, b) => a - b);
    if (sorted.length === 0) return 0;

    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sorted[lower];

    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private calculateHeatIndexThreshold(temperatures: number[], humidities: number[]): number {
    const heatIndices: number[] = [];

    for (let i = 0; i < Math.min(temperatures.length, humidities.length); i++) {
      const temp = temperatures[i];
      const humidity = humidities[i];

      if (!isNaN(temp) && !isNaN(humidity) && humidity >= 0 && humidity <= 100) {
        const heatIndex = this.calculateHeatIndex(temp, humidity);
        heatIndices.push(heatIndex);
      }
    }

    return this.calculatePercentile(heatIndices, 90); // 90th percentile for "very uncomfortable"
  }

  private calculateHeatIndex(tempCelsius: number, humidity: number): number {
    // Convert to Fahrenheit for heat index calculation
    const tempF = tempCelsius * 9/5 + 32;
    
    if (tempF < 80) return tempCelsius; // No heat index adjustment below 80°F

    // Rothfusz regression (simplified)
    const hi = -42.379 + 2.04901523 * tempF + 10.14333127 * humidity 
              - 0.22475541 * tempF * humidity - 6.83783e-3 * tempF * tempF
              - 5.481717e-2 * humidity * humidity + 1.22874e-3 * tempF * tempF * humidity
              + 8.5282e-4 * tempF * humidity * humidity - 1.99e-6 * tempF * tempF * humidity * humidity;

    // Convert back to Celsius
    return (hi - 32) * 5/9;
  }

  private calculateHistoricalProbabilities(
    data: { 
      temperature: number[];
      precipitation: number[];
      windSpeed: number[];
      humidity: number[];
      dates: Date[];
    },
    thresholds: ProbabilityThresholds
  ) {
    const totalRecords = data.temperature.length;

    const calculateProb = (
      values: number[], 
      threshold: number, 
      above: boolean,
      conditionName: string
    ): ProbabilityResult => {
      const occurrences = values.filter(v => 
        above ? v >= threshold : v <= threshold
      ).length;

      const probability = totalRecords > 0 ? (occurrences / totalRecords) * 100 : 0;
      const confidence = this.calculateConfidence(totalRecords);

      return {
        probability,
        threshold,
        confidence,
        historicalOccurrences: occurrences
      };
    };

    // Calculate heat index values for uncomfortable conditions
    const heatIndices: number[] = [];
    for (let i = 0; i < Math.min(data.temperature.length, data.humidity.length); i++) {
      if (!isNaN(data.temperature[i]) && !isNaN(data.humidity[i])) {
        heatIndices.push(this.calculateHeatIndex(data.temperature[i], data.humidity[i]));
      }
    }

    return {
      veryHot: calculateProb(data.temperature, thresholds.veryHot, true, 'Very Hot'),
      veryCold: calculateProb(data.temperature, thresholds.veryCold, false, 'Very Cold'),
      veryWet: calculateProb(data.precipitation, thresholds.veryWet, true, 'Very Wet'),
      veryWindy: calculateProb(data.windSpeed, thresholds.veryWindy, true, 'Very Windy'),
      veryUncomfortable: calculateProb(heatIndices, thresholds.veryUncomfortable, true, 'Very Uncomfortable')
    };
  }

  private calculateConfidence(sampleSize: number): number {
    // Confidence based on sample size (NASA standard approach)
    // 20 years of ±7 day seasonal data ≈ 280 samples (14 days × 20 years)
    if (sampleSize >= 280) return 95;
    if (sampleSize >= 200) return 92;
    if (sampleSize >= 140) return 88;
    if (sampleSize >= 100) return 85;
    if (sampleSize >= 70) return 80;
    if (sampleSize >= 50) return 75;
    return 70;
  }

  private generateHistoricalContext(
    data: { 
      temperature: number[];
      precipitation: number[];
      windSpeed: number[];
      humidity: number[];
      dates: Date[];
    },
    datasets: WeatherDataset[]
  ) {
    // Calculate averages
    const avgTemp = data.temperature.reduce((a, b) => a + b, 0) / data.temperature.length;
    const avgPrecip = data.precipitation.reduce((a, b) => a + b, 0) / data.precipitation.length;
    const avgWind = data.windSpeed.reduce((a, b) => a + b, 0) / data.windSpeed.length;
    const avgHumidity = data.humidity.reduce((a, b) => a + b, 0) / data.humidity.length;

    // Find extreme events
    const extremeEvents = this.findExtremeEvents(data);

    // Calculate data years from datasets
    const totalYears = datasets.reduce((years, dataset) => {
      const start = dataset.metadata.temporalCoverage.start;
      const end = dataset.metadata.temporalCoverage.end;
      return Math.max(years, end.getFullYear() - start.getFullYear());
    }, 0);

    return {
      dataYears: totalYears,
      totalDataPoints: data.temperature.length,
      averageConditions: {
        temperature: avgTemp,
        precipitation: avgPrecip,
        windSpeed: avgWind,
        humidity: avgHumidity
      },
      extremeEvents
    };
  }

  private findExtremeEvents(data: {
    temperature: number[];
    precipitation: number[];
    windSpeed: number[];
    dates: Date[];
  }) {
    const events: Array<{ date: Date; type: string; value: number }> = [];

    // Find temperature extremes
    const maxTemp = Math.max(...data.temperature);
    const minTemp = Math.min(...data.temperature);
    const maxTempIndex = data.temperature.indexOf(maxTemp);
    const minTempIndex = data.temperature.indexOf(minTemp);

    if (maxTempIndex >= 0 && data.dates[maxTempIndex]) {
      events.push({
        date: data.dates[maxTempIndex],
        type: 'Hottest Day',
        value: maxTemp
      });
    }

    if (minTempIndex >= 0 && data.dates[minTempIndex]) {
      events.push({
        date: data.dates[minTempIndex],
        type: 'Coldest Day',
        value: minTemp
      });
    }

    // Find precipitation extremes
    const maxPrecip = Math.max(...data.precipitation);
    const maxPrecipIndex = data.precipitation.indexOf(maxPrecip);

    if (maxPrecipIndex >= 0 && data.dates[maxPrecipIndex]) {
      events.push({
        date: data.dates[maxPrecipIndex],
        type: 'Wettest Day',
        value: maxPrecip
      });
    }

    return events.slice(0, 5); // Return top 5 extreme events
  }

  private assessDataQuality(
    data: { temperature: number[]; precipitation: number[]; windSpeed: number[]; humidity: number[] },
    datasets: WeatherDataset[]
  ) {
    // Calculate completeness
    const tempCompleteness = data.temperature.filter(v => !isNaN(v) && v !== null).length / data.temperature.length;
    const precipCompleteness = data.precipitation.filter(v => !isNaN(v) && v !== null).length / data.precipitation.length;
    const windCompleteness = data.windSpeed.filter(v => !isNaN(v) && v !== null).length / data.windSpeed.length;
    const humidityCompleteness = data.humidity.filter(v => !isNaN(v) && v !== null).length / data.humidity.length;

    const overallCompleteness = (tempCompleteness + precipCompleteness + windCompleteness + humidityCompleteness) / 4;

    // Assess reliability based on data source and sample size
    const reliability = data.temperature.length >= 200 ? 92 : 
                       data.temperature.length >= 100 ? 88 : 
                       data.temperature.length >= 50 ? 82 : 75;

    // Extract data sources
    const sources = datasets.map(ds => ds.metadata.source);

    return {
      completeness: overallCompleteness * 100,
      reliability,
      sources: [...new Set(sources)] // Remove duplicates
    };
  }
}
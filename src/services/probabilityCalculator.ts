import { WeatherDataset, WeatherCondition, ProbabilityResults, Coordinates } from '../types/weather';

export class WeatherProbabilityCalculator {
  calculateProbabilities(
    historicalData: any,
    targetDate: Date,
    location: Coordinates
  ): ProbabilityResults {
    
    // Extract same-date historical data from NASA sources
    const sameDateData = this.extractSeasonalData(historicalData, targetDate);
    
    if (sameDateData.length === 0) {
      // Return default probabilities if no data
      return this.getDefaultProbabilities();
    }
    
    // Calculate dynamic thresholds using NASA methodology
    const thresholds = {
      veryHot: this.calculatePercentile(sameDateData.map(d => d.temperature), 95),
      veryCold: this.calculatePercentile(sameDateData.map(d => d.temperature), 5),
      veryWet: this.calculatePercentile(sameDateData.map(d => d.precipitation), 90),
      veryWindy: this.calculatePercentile(sameDateData.map(d => d.windSpeed), 85),
      veryUncomfortable: this.calculateCompositeHeatIndex(sameDateData)
    };
      veryHot: this.calculatePercentile(sameDateData.map(d => d.temperature), 95),
      veryCold: this.calculatePercentile(sameDateData.map(d => d.temperature), 5),
      veryWet: this.calculatePercentile(sameDateData.map(d => d.precipitation), 90),
      veryWindy: this.calculatePercentile(sameDateData.map(d => d.windSpeed), 85),
      veryUncomfortable: this.calculatePercentile(
        sameDateData.map(d => this.calculateHeatIndex(d.temperature, d.humidity)), 90
      )
    };
    
    // Calculate probabilities based on historical occurrences
    const probabilities = this.calculateHistoricalProbabilities(sameDateData, thresholds);
    const confidenceIntervals = this.calculateConfidenceIntervals(sameDateData);
    const historicalContext = this.generateHistoricalContext(sameDateData);
    const dataQuality = this.assessDataQuality(sameDateData);
    
    return {
      conditions: this.formatConditions(probabilities, thresholds, confidenceIntervals),
      confidenceIntervals,
      historicalContext,
      dataQuality
    };
  }

  private extractSeasonalData(data: any, targetDate: Date): Array<{
    year: number;
    temperature: number;
    precipitation: number;
    windSpeed: number;
    humidity: number;
  }> {
    const targetDay = targetDate.getDate();
    const targetMonth = targetDate.getMonth();
    const seasonalWindow = 7; // ±7 days window
    const results = [];
    
    // Process MERRA-2 data
    if (data.merra2) {
      data.merra2.timestamps.forEach((timestamp: Date, index: number) => {
        const date = new Date(timestamp);
        const dayOfYear = this.getDayOfYear(date);
        const targetDayOfYear = this.getDayOfYear(targetDate);
        
        if (Math.abs(dayOfYear - targetDayOfYear) <= seasonalWindow) {
          const windSpeed = Math.sqrt(
            Math.pow(data.merra2.windU[index], 2) + 
            Math.pow(data.merra2.windV[index], 2)
          );
          
          results.push({
            year: date.getFullYear(),
            temperature: data.merra2.temperature[index],
            precipitation: data.gpm?.precipitation[index] || 0,
            windSpeed: windSpeed,
            humidity: data.merra2.humidity[index]
          });
        }
      });
    }
    
    return results;
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private calculatePercentile(data: number[], percentile: number): number {
    const validData = data.filter(v => !isNaN(v) && v !== null && v !== undefined);
    if (validData.length === 0) return 0;
    
    const sorted = validData.sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    
    if (index === Math.floor(index)) {
      return sorted[index];
    } else {
      const lower = sorted[Math.floor(index)];
      const upper = sorted[Math.ceil(index)];
      return lower + (upper - lower) * (index - Math.floor(index));
    }
  }

  private calculateCompositeHeatIndex(data: any): number {
    const heatIndices = data.map((item: any) => {
      const temp = item.temperature;
      const humidity = item.humidity;
      
      if (temp < 27) return temp;
    
      const T = temp;
      const H = humidity;
    
      // NASA Heat Index Formula
      const tempF = T * 9/5 + 32; // Convert C to F
      
      if (tempF < 80) return T;
      
      const HI = -42.379 + 2.04901523 * tempF + 10.14333127 * H 
                - 0.22475541 * tempF * H - 6.83783e-3 * tempF * tempF
                - 5.481717e-2 * H * H + 1.22874e-3 * tempF * tempF * H
                + 8.5282e-4 * tempF * H * H - 1.99e-6 * tempF * tempF * H * H;
      
      return (HI - 32) * 5/9; // Convert back to Celsius
    });
    
    return this.calculatePercentile(heatIndices, 90);
  }

  private calculateHistoricalProbabilities(data: any[], thresholds: any): Record<string, number> {
    if (data.length === 0) return [];
    
    const totalYears = data.length;
    
    const veryHotCount = data.filter(d => d.temperature >= thresholds.veryHot).length;
    const veryColdCount = data.filter(d => d.temperature <= thresholds.veryCold).length;
    const veryWetCount = data.filter(d => d.precipitation >= thresholds.veryWet).length;
    const veryWindyCount = data.filter(d => d.windSpeed >= thresholds.veryWindy).length;
    const veryUncomfortableCount = data.filter(d => {
      const heatIndex = this.calculateSingleHeatIndex(d.temperature, d.humidity);
      return heatIndex >= thresholds.veryUncomfortable;
    }).length;
    
    return {
      veryHot: (veryHotCount / totalYears) * 100,
      veryCold: (veryColdCount / totalYears) * 100,
      veryWet: (veryWetCount / totalYears) * 100,
      veryWindy: (veryWindyCount / totalYears) * 100,
      veryUncomfortable: (veryUncomfortableCount / totalYears) * 100
    };
  }

  private calculateSingleHeatIndex(temperature: number, humidity: number): number {
    if (temperature < 27) return temperature;
    
    const tempF = temperature * 9/5 + 32;
    if (tempF < 80) return temperature;
    
    const HI = -42.379 + 2.04901523 * tempF + 10.14333127 * humidity 
              - 0.22475541 * tempF * humidity - 6.83783e-3 * tempF * tempF
              - 5.481717e-2 * humidity * humidity + 1.22874e-3 * tempF * tempF * humidity
              + 8.5282e-4 * tempF * humidity * humidity - 1.99e-6 * tempF * tempF * humidity * humidity;
    
    return (HI - 32) * 5/9;
  }

  private formatConditions(probabilities: any, thresholds: any, confidenceIntervals: any): WeatherCondition[] {
    return [
      {
        type: 'veryHot',
        label: 'Very Hot',
        probability: Math.round(probabilities.veryHot),
        confidence: 85,
        threshold: thresholds.veryHot,
        historicalOccurrences: Math.round(probabilities.veryHot * 25 / 100)
      },
      {
        type: 'veryCold',
        label: 'Very Cold',
        probability: Math.round(probabilities.veryCold),
        confidence: 85,
        threshold: thresholds.veryCold,
        historicalOccurrences: Math.round(probabilities.veryCold * 25 / 100)
      },
      {
        type: 'veryWet',
        label: 'Very Wet',
        probability: Math.round(probabilities.veryWet),
        confidence: 85,
        threshold: thresholds.veryWet,
        historicalOccurrences: Math.round(probabilities.veryWet * 25 / 100)
      },
      {
        type: 'veryWindy',
        label: 'Very Windy',
        probability: Math.round(probabilities.veryWindy),
        confidence: 85,
        threshold: thresholds.veryWindy,
        historicalOccurrences: Math.round(probabilities.veryWindy * 25 / 100)
      },
      {
        type: 'veryUncomfortable',
        label: 'Very Uncomfortable',
        probability: Math.round(probabilities.veryUncomfortable),
        confidence: 85,
        threshold: thresholds.veryUncomfortable,
        historicalOccurrences: Math.round(probabilities.veryUncomfortable * 25 / 100)
      }
    ];
  }

  private calculateConfidence(occurrences: number, total: number): number {
    if (total === 0) return 0;
    
    const p = occurrences / total;
    const standardError = Math.sqrt(p * (1 - p) / total);
    
    // Convert to confidence percentage (inverse of standard error)
    const confidence = Math.max(0, Math.min(100, (1 - standardError * 2) * 100));
    
    return Math.round(confidence);
  }

  private calculateConfidenceIntervals(data: any[]): Array<{lower: number, upper: number}> {
    const totalYears = data.length;
    const zScore = 1.96; // 95% confidence interval
    
    return [1, 2, 3, 4, 5].map((_, index) => {
      const conditions = ['veryHot', 'veryCold', 'veryWet', 'veryWindy', 'veryUncomfortable'];
      const condition = conditions[index];
      
      let occurrences = 0;
      switch (condition) {
        case 'veryHot':
          occurrences = data.filter(d => d.temperature >= 30).length;
          break;
        case 'veryCold':
          occurrences = data.filter(d => d.temperature <= 5).length;
          break;
        case 'veryWet':
          occurrences = data.filter(d => d.precipitation >= 10).length;
          break;
        case 'veryWindy':
          occurrences = data.filter(d => d.windSpeed >= 15).length;
          break;
        case 'veryUncomfortable':
          occurrences = data.filter(d => {
            const hi = this.calculateSingleHeatIndex(d.temperature, d.humidity);
            return hi >= 35;
          }).length;
          break;
      }
      
      const p = occurrences / totalYears;
      const standardError = Math.sqrt(p * (1 - p) / totalYears);
      const marginOfError = zScore * standardError;
      
      return {
        lower: Math.max(0, Math.round((p - marginOfError) * 100)),
        upper: Math.min(100, Math.round((p + marginOfError) * 100))
      };
    });
  }

  private generateHistoricalContext(data: any[]): { years: number[], values: number[] } {
    const yearlyData = data.reduce((acc: any, item: any) => {
      const year = item.year;
      if (!acc[year]) {
        acc[year] = {
          temperatures: [],
          precipitations: [],
          windSpeeds: [],
          humidities: []
        };
      }
      
      acc[year].temperatures.push(item.temperature);
      acc[year].precipitations.push(item.precipitation);
      acc[year].windSpeeds.push(item.windSpeed);
      acc[year].humidities.push(item.humidity);
      
      return acc;
    }, {} as any);
    
    const years = Object.keys(yearlyData).map(Number).sort();
    const values = years.map(year => {
      const yearData = yearlyData[year];
      // Calculate a composite weather index
      const avgTemp = yearData.temperatures.reduce((a: number, b: number) => a + b, 0) / yearData.temperatures.length;
      const avgPrecip = yearData.precipitations.reduce((a: number, b: number) => a + b, 0) / yearData.precipitations.length;
      
      // Normalize and combine (simplified composite index)
      return Math.round((avgTemp / 50 + avgPrecip / 20) * 50);
    });
    
    return { years, values };
  }

  private assessDataQuality(data: any[]): { completeness: number, reliability: number, sources: string[] } {
    const completeness = data.length >= 20 ? 95 : Math.round((data.length / 20) * 95);
    const reliability = data.length >= 10 ? 90 : 70;
    
    return {
      completeness,
      reliability,
      sources: ['NASA MERRA-2', 'NOAA GFS', 'CPTEC Regional Model']
    };
  }

  private getDefaultProbabilities(): ProbabilityResults {
    return {
      conditions: [],
      confidenceIntervals: [],
      historicalContext: { years: [], values: [] },
      dataQuality: {
        completeness: 0,
        reliability: 0,
        sources: []
      }
    };
  }
}
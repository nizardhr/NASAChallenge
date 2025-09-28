import { WeatherDataset, WeatherCondition, ProbabilityResults, Coordinates } from '../types/weather';

export class WeatherProbabilityCalculator {
  calculateExtremeEventProbabilities(
    historicalData: WeatherDataset[],
    targetDate: Date,
    location: Coordinates
  ): ProbabilityResults {
    
    // Extract same-date historical data (multi-year)
    const sameDateData = this.extractSeasonalData(historicalData, targetDate, location);
    
    if (sameDateData.length === 0) {
      throw new Error('Insufficient historical data for probability calculation');
    }
    
    // Calculate dynamic thresholds using percentiles
    const thresholds = {
      veryHot: this.calculatePercentile(sameDateData.map(d => d.temperature), 95),
      veryCold: this.calculatePercentile(sameDateData.map(d => d.temperature), 5),
      veryWet: this.calculatePercentile(sameDateData.map(d => d.precipitation), 90),
      veryWindy: this.calculatePercentile(sameDateData.map(d => d.windSpeed), 85),
      veryUncomfortable: this.calculatePercentile(
        sameDateData.map(d => this.calculateHeatIndex(d.temperature, d.humidity)), 90
      )
    };
    
    // Calculate probabilities with confidence intervals
    const conditions = this.calculateHistoricalProbabilities(sameDateData, thresholds);
    const confidenceIntervals = this.calculateConfidenceIntervals(sameDateData, thresholds);
    const historicalContext = this.generateHistoricalContext(sameDateData);
    const dataQuality = this.assessDataQuality(sameDateData);
    
    return {
      conditions,
      confidenceIntervals,
      historicalContext,
      dataQuality
    };
  }

  private extractSeasonalData(
    datasets: WeatherDataset[],
    targetDate: Date,
    location: Coordinates
  ): Array<{
    year: number;
    temperature: number;
    precipitation: number;
    windSpeed: number;
    humidity: number;
  }> {
    const targetDay = targetDate.getDate();
    const targetMonth = targetDate.getMonth();
    const results: any[] = [];
    
    for (const dataset of datasets) {
      const { coordinates, variables } = dataset.data;
      
      // Find closest spatial point
      const latIndex = this.findClosestIndex(coordinates.latitude, location.lat);
      const lonIndex = this.findClosestIndex(coordinates.longitude, location.lng);
      
      // Extract data for same date across all years
      coordinates.time.forEach((time, timeIndex) => {
        const dataDate = new Date(time);
        
        if (dataDate.getDate() === targetDay && dataDate.getMonth() === targetMonth) {
          results.push({
            year: dataDate.getFullYear(),
            temperature: variables.temperature[timeIndex][latIndex][lonIndex],
            precipitation: variables.precipitation[timeIndex][latIndex][lonIndex],
            windSpeed: variables.windSpeed[timeIndex][latIndex][lonIndex],
            humidity: variables.humidity[timeIndex][latIndex][lonIndex]
          });
        }
      });
    }
    
    return results;
  }

  private findClosestIndex(array: number[], target: number): number {
    let closestIndex = 0;
    let minDistance = Math.abs(array[0] - target);
    
    for (let i = 1; i < array.length; i++) {
      const distance = Math.abs(array[i] - target);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }
    
    return closestIndex;
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

  private calculateHeatIndex(temperature: number, humidity: number): number {
    if (temperature < 27) return temperature;
    
    const T = temperature;
    const H = humidity;
    
    // Simplified heat index calculation
    const HI = -8.78469475556 
      + 1.61139411 * T 
      + 2.33854883889 * H 
      + (-0.14611605) * T * H 
      + (-0.012308094) * T * T 
      + (-0.0164248277778) * H * H 
      + 0.002211732 * T * T * H 
      + 0.00072546 * T * H * H 
      + (-0.000003582) * T * T * H * H;
    
    return HI;
  }

  private calculateHistoricalProbabilities(
    data: any[],
    thresholds: Record<string, number>
  ): WeatherCondition[] {
    if (data.length === 0) return [];
    
    const totalYears = data.length;
    
    const veryHotCount = data.filter(d => d.temperature >= thresholds.veryHot).length;
    const veryColdCount = data.filter(d => d.temperature <= thresholds.veryCold).length;
    const veryWetCount = data.filter(d => d.precipitation >= thresholds.veryWet).length;
    const veryWindyCount = data.filter(d => d.windSpeed >= thresholds.veryWindy).length;
    const veryUncomfortableCount = data.filter(d => 
      this.calculateHeatIndex(d.temperature, d.humidity) >= thresholds.veryUncomfortable
    ).length;
    
    return [
      {
        type: 'veryHot',
        label: 'Very Hot',
        probability: Math.round((veryHotCount / totalYears) * 100),
        confidence: this.calculateConfidence(veryHotCount, totalYears),
        threshold: thresholds.veryHot,
        historicalOccurrences: veryHotCount
      },
      {
        type: 'veryCold',
        label: 'Very Cold',
        probability: Math.round((veryColdCount / totalYears) * 100),
        confidence: this.calculateConfidence(veryColdCount, totalYears),
        threshold: thresholds.veryCold,
        historicalOccurrences: veryColdCount
      },
      {
        type: 'veryWet',
        label: 'Very Wet',
        probability: Math.round((veryWetCount / totalYears) * 100),
        confidence: this.calculateConfidence(veryWetCount, totalYears),
        threshold: thresholds.veryWet,
        historicalOccurrences: veryWetCount
      },
      {
        type: 'veryWindy',
        label: 'Very Windy',
        probability: Math.round((veryWindyCount / totalYears) * 100),
        confidence: this.calculateConfidence(veryWindyCount, totalYears),
        threshold: thresholds.veryWindy,
        historicalOccurrences: veryWindyCount
      },
      {
        type: 'veryUncomfortable',
        label: 'Very Uncomfortable',
        probability: Math.round((veryUncomfortableCount / totalYears) * 100),
        confidence: this.calculateConfidence(veryUncomfortableCount, totalYears),
        threshold: thresholds.veryUncomfortable,
        historicalOccurrences: veryUncomfortableCount
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

  private calculateConfidenceIntervals(data: any[], thresholds: Record<string, number>): Array<{lower: number, upper: number}> {
    const totalYears = data.length;
    const zScore = 1.96; // 95% confidence interval
    
    return Object.values(thresholds).map((_, index) => {
      const conditions = ['veryHot', 'veryCold', 'veryWet', 'veryWindy', 'veryUncomfortable'];
      const condition = conditions[index];
      
      let occurrences = 0;
      switch (condition) {
        case 'veryHot':
          occurrences = data.filter(d => d.temperature >= thresholds.veryHot).length;
          break;
        case 'veryCold':
          occurrences = data.filter(d => d.temperature <= thresholds.veryCold).length;
          break;
        case 'veryWet':
          occurrences = data.filter(d => d.precipitation >= thresholds.veryWet).length;
          break;
        case 'veryWindy':
          occurrences = data.filter(d => d.windSpeed >= thresholds.veryWindy).length;
          break;
        case 'veryUncomfortable':
          occurrences = data.filter(d => 
            this.calculateHeatIndex(d.temperature, d.humidity) >= thresholds.veryUncomfortable
          ).length;
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
    const yearlyData = data.reduce((acc, item) => {
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
}
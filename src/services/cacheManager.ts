import { WeatherDataset, CacheEntry, Coordinates, DateRange } from '../types/weather';

export class CacheManager {
  private memoryCache = new Map<string, CacheEntry>();
  private dbName = 'WeatherDataCache';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('weatherData')) {
          const store = db.createObjectStore('weatherData', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('location', 'location', { unique: false });
        }
      };
    });
  }

  generateCacheKey(location: Coordinates, dateRange: DateRange, source?: string): string {
    const locationKey = `${location.lat.toFixed(4)},${location.lng.toFixed(4)}`;
    const dateKey = `${dateRange.start.getTime()}-${dateRange.end.getTime()}`;
    const sourceKey = source || 'all';
    
    return `${locationKey}_${dateKey}_${sourceKey}`;
  }

  async getCachedData(
    location: Coordinates, 
    dateRange: DateRange,
    source?: string
  ): Promise<WeatherDataset | null> {
    const cacheKey = this.generateCacheKey(location, dateRange, source);
    
    // Level 1: Memory Cache (fastest)
    if (this.memoryCache.has(cacheKey)) {
      const entry = this.memoryCache.get(cacheKey)!;
      if (!this.isExpired(entry)) {
        return entry.data;
      } else {
        this.memoryCache.delete(cacheKey);
      }
    }
    
    // Level 2: IndexedDB (persistent)
    const indexedData = await this.getFromIndexedDB(cacheKey);
    if (indexedData && !this.isExpired(indexedData)) {
      // Promote to memory cache
      this.memoryCache.set(cacheKey, indexedData);
      return indexedData.data;
    }
    
    // Level 3: Service Worker Cache would go here
    return null;
  }
  
  async cacheData(
    location: Coordinates,
    dateRange: DateRange, 
    data: WeatherDataset,
    source?: string
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(location, dateRange, source);
    const cacheEntry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: 24 * 60 * 60 * 1000 // 24 hours
    };
    
    // Store in memory cache
    this.memoryCache.set(cacheKey, cacheEntry);
    
    // Store in IndexedDB
    await this.storeInIndexedDB(cacheKey, cacheEntry);
    
    // Clean up expired entries periodically
    this.cleanupExpiredEntries();
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private async getFromIndexedDB(key: string): Promise<CacheEntry | null> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve(null);
        return;
      }

      const transaction = this.db.transaction(['weatherData'], 'readonly');
      const store = transaction.objectStore('weatherData');
      const request = store.get(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.entry : null);
      };
    });
  }

  private async storeInIndexedDB(key: string, entry: CacheEntry): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['weatherData'], 'readwrite');
      const store = transaction.objectStore('weatherData');
      
      const request = store.put({
        key,
        entry,
        timestamp: entry.timestamp
      });
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private cleanupExpiredEntries(): void {
    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
      }
    }

    // Clean IndexedDB (run occasionally)
    if (Math.random() < 0.1) { // 10% chance on each cache operation
      this.cleanupIndexedDB();
    }
  }

  private async cleanupIndexedDB(): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['weatherData'], 'readwrite');
    const store = transaction.objectStore('weatherData');
    const index = store.index('timestamp');
    
    const expiredThreshold = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    const range = IDBKeyRange.upperBound(expiredThreshold);
    
    const request = index.openCursor(range);
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  }

  async clearCache(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();
    
    // Clear IndexedDB
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['weatherData'], 'readwrite');
      const store = transaction.objectStore('weatherData');
      const request = store.clear();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  getCacheStats(): { memoryEntries: number, totalMemorySize: number } {
    const memoryEntries = this.memoryCache.size;
    
    // Estimate memory size (rough calculation)
    let totalMemorySize = 0;
    for (const entry of this.memoryCache.values()) {
      // Rough estimate based on data structure
      const dataSize = JSON.stringify(entry.data).length;
      totalMemorySize += dataSize;
    }
    
    return {
      memoryEntries,
      totalMemorySize: Math.round(totalMemorySize / 1024) // KB
    };
  }
}
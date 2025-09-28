import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Crosshair } from 'lucide-react';
import { Coordinates } from '../types/weather';

interface LocationPickerProps {
  onLocationSelect: (location: Coordinates) => void;
  selectedLocation: Coordinates | null;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  onLocationSelect,
  selectedLocation
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{
    name: string;
    coordinates: Coordinates;
    country: string;
  }>>([]);

  // Mock location data for demonstration
  const mockLocations = [
    { name: 'New York', coordinates: { lat: 40.7128, lng: -74.0060 }, country: 'USA' },
    { name: 'London', coordinates: { lat: 51.5074, lng: -0.1278 }, country: 'UK' },
    { name: 'Tokyo', coordinates: { lat: 35.6762, lng: 139.6503 }, country: 'Japan' },
    { name: 'Sydney', coordinates: { lat: -33.8688, lng: 151.2093 }, country: 'Australia' },
    { name: 'São Paulo', coordinates: { lat: -23.5505, lng: -46.6333 }, country: 'Brazil' },
    { name: 'Cairo', coordinates: { lat: 30.0444, lng: 31.2357 }, country: 'Egypt' },
    { name: 'Mumbai', coordinates: { lat: 19.0760, lng: 72.8777 }, country: 'India' },
    { name: 'Lagos', coordinates: { lat: 6.5244, lng: 3.3792 }, country: 'Nigeria' }
  ];

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    
    // Simulate API call delay
    setTimeout(() => {
      const filtered = mockLocations.filter(location =>
        location.name.toLowerCase().includes(query.toLowerCase()) ||
        location.country.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filtered);
      setIsSearching(false);
    }, 300);
  }, []);

  const handleLocationSelect = useCallback((location: Coordinates) => {
    onLocationSelect(location);
    setSearchQuery('');
    setSuggestions([]);
  }, [onLocationSelect]);

  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          handleLocationSelect(coords);
        },
        (error) => {
          console.error('Error getting location:', error);
          // Fallback to default location (New York)
          handleLocationSelect({ lat: 40.7128, lng: -74.0060 });
        }
      );
    }
  }, [handleLocationSelect]);

  return (
    <div className="location-picker">
      <div className="search-container clay-inset">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Search for a city or coordinates..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
          <motion.button
            className="current-location-button glass-button"
            onClick={getCurrentLocation}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Use current location"
          >
            <Crosshair size={16} />
          </motion.button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <motion.div
          className="suggestions-dropdown glass-surface"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {suggestions.map((suggestion, index) => (
            <motion.button
              key={`${suggestion.name}-${suggestion.country}`}
              className="suggestion-item"
              onClick={() => handleLocationSelect(suggestion.coordinates)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            >
              <MapPin size={16} />
              <div className="suggestion-details">
                <span className="suggestion-name">{suggestion.name}</span>
                <span className="suggestion-country">{suggestion.country}</span>
                <span className="suggestion-coords">
                  {suggestion.coordinates.lat.toFixed(4)}°, {suggestion.coordinates.lng.toFixed(4)}°
                </span>
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}

      {selectedLocation && (
        <motion.div
          className="selected-location glass-surface"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <MapPin className="location-icon" size={20} />
          <div className="location-details">
            <span className="location-label">Selected Location</span>
            <span className="location-coords">
              {selectedLocation.lat.toFixed(4)}°N, {Math.abs(selectedLocation.lng).toFixed(4)}°{selectedLocation.lng >= 0 ? 'E' : 'W'}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
};
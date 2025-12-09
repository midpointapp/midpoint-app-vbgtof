
import { SessionParticipant } from '@/types';
import { GOOGLE_PLACES_API_KEY, DEFAULT_SEARCH_RADIUS } from '@/constants/config';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  distance: number;
  placeId?: string;
}

/**
 * Mask coordinates by rounding to 2 decimal places for SafeMeet mode
 * @param lat - Latitude to mask
 * @param lng - Longitude to mask
 * @returns Masked coordinates
 */
export function maskCoordinates(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
  };
}

/**
 * Calculate the geographic midpoint between two coordinates
 * @param userLat - User's latitude
 * @param userLng - User's longitude
 * @param contactLat - Contact's latitude
 * @param contactLng - Contact's longitude
 * @param safeMeet - If true, mask user's location by rounding to 2 decimals
 * @returns Midpoint coordinates
 */
export function calculateMidpoint(
  userLat: number,
  userLng: number,
  contactLat: number,
  contactLng: number,
  safeMeet: boolean = false
): { midLat: number; midLng: number } {
  // SafeMeet: mask user's location by rounding to 2 decimals
  const maskedUserLat = safeMeet ? Math.round(userLat * 100) / 100 : userLat;
  const maskedUserLng = safeMeet ? Math.round(userLng * 100) / 100 : userLng;
  
  // Calculate simple midpoint
  const midLat = (maskedUserLat + contactLat) / 2;
  const midLng = (maskedUserLng + contactLng) / 2;
  
  console.log('Midpoint calculation:', {
    userLat: maskedUserLat,
    userLng: maskedUserLng,
    contactLat,
    contactLng,
    midLat,
    midLng,
    safeMeet,
  });
  
  return { midLat, midLng };
}

/**
 * Calculate the midpoint from multiple participants (legacy function)
 */
export function calculateMidpointFromParticipants(participants: SessionParticipant[]): Coordinates | null {
  const validParticipants = participants.filter(
    (p) => p.user_lat !== undefined && p.user_lng !== undefined
  );

  if (validParticipants.length === 0) {
    console.log('No valid participants with location data');
    return null;
  }

  const sumLat = validParticipants.reduce((sum, p) => sum + (p.user_lat || 0), 0);
  const sumLng = validParticipants.reduce((sum, p) => sum + (p.user_lng || 0), 0);

  return {
    latitude: sumLat / validParticipants.length,
    longitude: sumLng / validParticipants.length,
  };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the Earth in km
  const toRadians = (angle: number) => (angle * Math.PI) / 180;
  
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Map meetup type to Google Places API parameters
 */
export function getGooglePlacesType(meetupType: string): { type?: string; keyword?: string } {
  switch (meetupType) {
    case 'gas':
      return { type: 'gas_station' };
    case 'restaurant':
      return { type: 'restaurant', keyword: 'coffee' };
    case 'police':
      return { type: 'police' };
    case 'rest':
      return { keyword: 'rest area' };
    case 'public':
      return { type: 'point_of_interest' };
    default:
      return { type: 'point_of_interest' };
  }
}

/**
 * Search for nearby places using Google Places API
 * @param midLat - Midpoint latitude
 * @param midLng - Midpoint longitude
 * @param meetupType - Type of meetup (gas, restaurant, police, rest, public)
 * @returns Array of places sorted by rating and distance
 */
export async function searchNearbyPlaces(
  midLat: number,
  midLng: number,
  meetupType: string
): Promise<Place[]> {
  // Check if API key is configured
  if (!GOOGLE_PLACES_API_KEY || GOOGLE_PLACES_API_KEY === 'YOUR_GOOGLE_API_KEY_HERE') {
    console.error('Google Places API key not configured');
    throw new Error('Google Places API key not configured. Please add your API key in constants/config.ts');
  }

  const { type, keyword } = getGooglePlacesType(meetupType);
  const location = `${midLat},${midLng}`;
  const radius = DEFAULT_SEARCH_RADIUS;

  // Build URL with parameters
  let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location}&radius=${radius}`;
  
  if (type) {
    url += `&type=${type}`;
  }
  
  if (keyword) {
    url += `&keyword=${encodeURIComponent(keyword)}`;
  }
  
  url += `&key=${GOOGLE_PLACES_API_KEY}`;

  console.log('Searching Google Places API:', { midLat, midLng, meetupType, type, keyword });

  try {
    const response = await fetch(url);
    const data = await response.json();

    console.log('Google Places API response status:', data.status);

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Parse and transform results
      const places: Place[] = data.results.map((place: any) => {
        const placeLat = place.geometry.location.lat;
        const placeLng = place.geometry.location.lng;
        const distance = calculateDistance(midLat, midLng, placeLat, placeLng);

        return {
          id: place.place_id || `place-${Date.now()}-${Math.random()}`,
          name: place.name,
          address: place.vicinity || place.formatted_address || 'Address not available',
          latitude: placeLat,
          longitude: placeLng,
          rating: place.rating || 0,
          distance: distance,
          placeId: place.place_id,
        };
      });

      // Sort by rating (descending), then by distance (ascending)
      places.sort((a, b) => {
        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }
        return a.distance - b.distance;
      });

      // Return top 5 places
      const topPlaces = places.slice(0, 5);
      console.log(`Found ${places.length} places, returning top ${topPlaces.length}`);
      
      return topPlaces;
    } else if (data.status === 'ZERO_RESULTS') {
      console.log('No places found in the area');
      return [];
    } else if (data.status === 'REQUEST_DENIED') {
      console.error('Google Places API request denied:', data.error_message);
      throw new Error(`API request denied: ${data.error_message || 'Check your API key and billing'}`);
    } else if (data.status === 'INVALID_REQUEST') {
      console.error('Invalid request to Google Places API:', data.error_message);
      throw new Error(`Invalid request: ${data.error_message || 'Check request parameters'}`);
    } else {
      console.error('Google Places API error:', data.status, data.error_message);
      throw new Error(`API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.error('Error fetching places from Google Places API:', error);
    
    // Re-throw with more context
    if (error.message && error.message.includes('API')) {
      throw error;
    }
    
    throw new Error(`Failed to fetch places: ${error.message || 'Network error'}`);
  }
}

/**
 * Open a location in the device's maps app
 */
export function openMapsApp(latitude: number, longitude: number, label?: string) {
  const url = label 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}&query_place_id=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  
  console.log('Opening maps with URL:', url);
  return url;
}

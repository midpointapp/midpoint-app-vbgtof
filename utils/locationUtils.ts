
import { SessionParticipant } from '@/types';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function calculateMidpoint(participants: SessionParticipant[]): Coordinates | null {
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

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

export function openMapsApp(latitude: number, longitude: number, label?: string) {
  const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  console.log('Opening maps with URL:', url);
  // In a real app, use Linking.openURL(url)
}

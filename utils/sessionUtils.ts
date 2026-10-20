
import { Alert, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { secureSessionRequest, type MeetingCategory } from './secureSessionApi';
import { supabase } from '../app/integrations/supabase/client';
import { searchNearbyPlaces, Place, calculateDynamicRadius, calculateDistance } from './locationUtils';

export async function createSessionAndSendInvite(category: string, senderLat: number, senderLng: number) {
  const baseUrl = process.env.EXPO_PUBLIC_SECURE_SUPABASE_URL;
  if (!baseUrl) throw new Error('Secure meeting service is not configured.');
  const response = await secureSessionRequest(
    { action: 'create', type: category as MeetingCategory, lat: senderLat, lng: senderLng },
    { baseUrl }
  );
  const session = response.session as { id: string; invite_token?: string; join_code?: string } | undefined;
  if (!session?.id || !session.invite_token || !response.senderToken || !session.join_code) {
    throw new Error('The meeting service returned an incomplete invitation.');
  }
  const joinUrl = `https://golden-biscochitos-cff794.netlify.app/?sessionId=${encodeURIComponent(session.id)}&token=${encodeURIComponent(session.invite_token)}`;
  const message = `I want to meet you halfway! 📍\\n\\nOpen this link to find our midpoint:\\n${joinUrl}\\n\\nOr enter code in MidPoint Meet: ${session.join_code}`;
  if (Platform.OS === 'web') {
    await Clipboard.setStringAsync(message);
    Alert.alert('Copied!', 'Invite copied to clipboard.');
  } else {
    await Share.share({ message });
  }
  // Never put the sender token in a shared invitation or diagnostic log.
  return { ...session, sender_token: response.senderToken };
}

/**
 * Generate midpoint places for a session
 * CRITICAL FIX: Enhanced coordinate validation before API calls
 * This is the function that should be called from session.tsx
 * It calculates midpoint and searches for places, returning Place[] directly
 */
export async function generateMidpointPlaces(
  senderLat: number,
  senderLng: number,
  receiverLat: number,
  receiverLng: number,
  category: string
): Promise<Place[]> {
  try {
    if (
      typeof senderLat !== 'number' || typeof senderLng !== 'number' ||
      typeof receiverLat !== 'number' || typeof receiverLng !== 'number' ||
      isNaN(senderLat) || isNaN(senderLng) || isNaN(receiverLat) || isNaN(receiverLng)
    ) {
      return [];
    }

    const midLat = (senderLat + receiverLat) / 2;
    const midLng = (senderLng + receiverLng) / 2;

    if (isNaN(midLat) || isNaN(midLng)) return [];

    const radius = calculateDynamicRadius(senderLat, senderLng, receiverLat, receiverLng);
    console.log('[SessionUtils] Dynamic radius:', radius, 'meters');

    let places = await searchNearbyPlaces(midLat, midLng, category, radius);

    // Retry with doubled radius if no results
    if (places.length === 0) {
      const retryRadius = Math.min(radius * 2, 50000);
      console.log('[SessionUtils] No results, retrying with radius:', retryRadius, 'meters');
      places = await searchNearbyPlaces(midLat, midLng, category, retryRadius);
    }

    return places.slice(0, 3);
  } catch {
    return [];
  }
}

/**
 * Legacy function that saves places to database
 * This is used by the old meet-session flow
 */
export async function generateAndSaveMidpointPlaces(
  sessionId: string,
  senderLat: number,
  senderLng: number,
  receiverLat: number,
  receiverLng: number,
  category: string
) {
  try {
    const places = await generateMidpointPlaces(senderLat, senderLng, receiverLat, receiverLng, category);

    if (places.length === 0) {
      console.warn('[SessionUtils] ⚠️ No places to save');
      return [];
    }

    const { error } = await supabase
      .from('session_places')
      .insert(
        places.map((place, index) => ({
          session_id: sessionId,
          place_id: place.placeId || place.id,
          name: place.name,
          address: place.address,
          lat: place.latitude,
          lng: place.longitude,
          rank: index + 1,
        }))
      );

    if (error) {
      console.error('[SessionUtils] ❌ Error inserting places:', error.message);
      throw new Error(error.message);
    }

    console.log('[SessionUtils] ✅ Saved', places.length, 'places to database');

    return places;
  } catch (error: any) {
    console.error('[SessionUtils] ❌ Error generating and saving places:', error.message);
    return [];
  }
}

export async function shareInviteUrl(url: string) {
  if (Platform.OS === 'web') {
    await Clipboard.setStringAsync(url);
    Alert.alert('Link Copied', 'Share it with your contact!');
  } else {
    await Share.share({ message: url });
  }
}

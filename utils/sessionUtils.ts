
import { Alert, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { generateId } from './idGenerator';
import { supabase } from '../app/integrations/supabase/client';
import { searchNearbyPlaces, Place } from './locationUtils';
import Constants from 'expo-constants';

const WEB_BASE_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_WEB_BASE_URL || process.env.EXPO_PUBLIC_WEB_BASE_URL;

export async function createSessionAndSendInvite(category: string, senderLat: number, senderLng: number) {
  const sessionId = generateId();
  const inviteToken = generateId();
  const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 7 * 1000).toISOString();

  // FIXED: Use /session route instead of /?
  const inviteUrl = `${WEB_BASE_URL}/session?sessionId=${sessionId}&token=${inviteToken}`;

  try {
    const { data: sessionData, error: sessionError } = await supabase
      .from('meet_sessions')
      .insert([{
        id: sessionId,
        type: category,
        sender_lat: senderLat,
        sender_lng: senderLng,
        invite_token: inviteToken,
        expires_at: expiresAt,
        status: 'waiting_for_receiver',
      }])
      .select('*')
      .single();

    if (sessionError) {
      console.error('[SessionUtils] Failed to create session:', JSON.stringify(sessionError, null, 2));
      throw new Error(sessionError.message);
    }

    if (!sessionData) {
      throw new Error('Session data is missing');
    }

    console.log('[SessionUtils] ✅ Session created:', sessionId);

    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(inviteUrl);
      Alert.alert('Invite Link Copied', 'Paste it into a message to share!');
    } else {
      await Share.share({ message: inviteUrl });
    }

    return sessionData;

  } catch (error: any) {
    console.error('[SessionUtils] Error:', error.message);
    throw error;
  }
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
  console.log('[SessionUtils] ========== GENERATE MIDPOINT PLACES ==========');
  console.log('[SessionUtils] Input params:', { senderLat, senderLng, receiverLat, receiverLng, category });
  console.log('[SessionUtils] Param types:', {
    senderLat: typeof senderLat,
    senderLng: typeof senderLng,
    receiverLat: typeof receiverLat,
    receiverLng: typeof receiverLng,
    category: typeof category
  });

  try {
    // CRITICAL FIX: Comprehensive coordinate validation
    if (typeof senderLat !== 'number' || typeof senderLng !== 'number' ||
        typeof receiverLat !== 'number' || typeof receiverLng !== 'number') {
      console.error('[SessionUtils] ❌ VALIDATION FAILED - Coordinates are not numbers');
      console.error('[SessionUtils] Types:', {
        senderLat: typeof senderLat,
        senderLng: typeof senderLng,
        receiverLat: typeof receiverLat,
        receiverLng: typeof receiverLng
      });
      return [];
    }

    if (isNaN(senderLat) || isNaN(senderLng) || isNaN(receiverLat) || isNaN(receiverLng)) {
      console.error('[SessionUtils] ❌ VALIDATION FAILED - Coordinates contain NaN values');
      console.error('[SessionUtils] Values:', { senderLat, senderLng, receiverLat, receiverLng });
      return [];
    }

    console.log('[SessionUtils] ✅ Coordinates validated successfully');

    // Calculate midpoint
    const midLat = (senderLat + receiverLat) / 2;
    const midLng = (senderLng + receiverLng) / 2;

    console.log('[SessionUtils] ✅ Midpoint calculated:', { midLat, midLng });

    // CRITICAL FIX: Validate midpoint before calling Places API
    if (isNaN(midLat) || isNaN(midLng)) {
      console.error('[SessionUtils] ❌ Midpoint calculation resulted in NaN');
      console.error('[SessionUtils] Midpoint:', { midLat, midLng });
      console.error('[SessionUtils] This should never happen if inputs were validated');
      return [];
    }

    console.log('[SessionUtils] Calling searchNearbyPlaces with validated coordinates...');
    const places = await searchNearbyPlaces(midLat, midLng, category);

    console.log('[SessionUtils] ✅ Places API returned', places.length, 'results');

    // Return top 3 places
    const topPlaces = places.slice(0, 3);
    console.log('[SessionUtils] ✅ Returning top', topPlaces.length, 'places');
    
    return topPlaces;
  } catch (error: any) {
    console.error('[SessionUtils] ❌ EXCEPTION in generateMidpointPlaces');
    console.error('[SessionUtils] Error type:', error.constructor.name);
    console.error('[SessionUtils] Error message:', error.message);
    console.error('[SessionUtils] Error stack:', error.stack);
    
    // Return empty array instead of throwing - allows UI to show "no places found"
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

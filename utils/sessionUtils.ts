
import { Alert, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { generateId, generateJoinCode } from './idGenerator';
import { supabase } from '../app/integrations/supabase/client';
import { searchNearbyPlaces, Place, calculateDynamicRadius, calculateDistance } from './locationUtils';

export async function createSessionAndSendInvite(category: string, senderLat: number, senderLng: number) {
  const sessionId = generateId();
  const inviteToken = generateId();
  const joinCode = generateJoinCode();
  const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 7 * 1000).toISOString();

  console.log('[SessionUtils] ========== CREATING SESSION ==========');
  console.log('[SessionUtils] Session ID:', sessionId);
  console.log('[SessionUtils] Invite token:', inviteToken);
  console.log('[SessionUtils] Join code:', joinCode);
  console.log('[SessionUtils] Category:', category);
  console.log('[SessionUtils] Sender location:', { lat: senderLat, lng: senderLng });

  try {
    const { data: sessionData, error: sessionError } = await supabase
      .from('meet_sessions')
      .insert([{
        id: sessionId,
        type: category,
        sender_lat: senderLat,
        sender_lng: senderLng,
        invite_token: inviteToken,
        join_code: joinCode,
        expires_at: expiresAt,
        status: 'waiting_for_receiver',
      }])
      .select('*')
      .single();

    if (sessionError) {
      console.error('[SessionUtils] ❌ Failed to create session:', JSON.stringify(sessionError, null, 2));
      throw new Error(sessionError.message);
    }

    if (!sessionData) {
      throw new Error('Session data is missing');
    }

    console.log('[SessionUtils] ✅ Session created successfully');
    console.log('[SessionUtils] ✅ Join code to share:', joinCode);

    const message = `Join me on MidPoint Meet!\n\nYour join code is: ${joinCode}\n\nOpen the app: https://web-midpoint-app-vbgtof.natively.dev\nThen tap 'Join a Meet' and enter the code.`;

    if (Platform.OS === 'web') {
      console.log('[SessionUtils] Web: copying join code to clipboard');
      await Clipboard.setStringAsync(message);
      Alert.alert('Code Copied!', message);
    } else {
      console.log('[SessionUtils] Native: sharing join code via Share sheet');
      await Share.share({ message });
    }

    return { ...sessionData, join_code: joinCode };

  } catch (error: any) {
    console.error('[SessionUtils] ❌ Error creating session:', error.message);
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

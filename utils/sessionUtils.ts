
import { Alert, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { generateId } from './idGenerator';
import { supabase } from '../app/integrations/supabase/client';
import { searchNearbyPlaces } from './locationUtils';
import Constants from 'expo-constants';

const WEB_BASE_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_WEB_BASE_URL || process.env.EXPO_PUBLIC_WEB_BASE_URL;

export async function createSessionAndSendInvite(category: string, senderLat: number, senderLng: number) {
  const sessionId = generateId();
  const inviteToken = generateId();
  const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 7 * 1000).toISOString();

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

export async function generateMidpointPlaces(
  sessionId: string,
  senderLat: number,
  senderLng: number,
  receiverLat: number,
  receiverLng: number,
  category: string
) {
  try {
    const midLat = (senderLat + receiverLat) / 2;
    const midLng = (senderLng + receiverLng) / 2;

    console.log('[SessionUtils] Midpoint:', { midLat, midLng });

    const places = await searchNearbyPlaces(midLat, midLng, category);

    console.log('[SessionUtils] Places API returned', places.length, 'results');

    const top3Places = places.slice(0, 3);

    const { error } = await supabase
      .from('session_places')
      .insert(
        top3Places.map((place, index) => ({
          session_id: sessionId,
          place_id: place.place_id,
          name: place.name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          rank: index + 1,
        }))
      );

    if (error) {
      console.error('[SessionUtils] Error inserting places:', error.message);
      throw new Error(error.message);
    }

    console.log('[SessionUtils] ✅ Saved', top3Places.length, 'places');

    return top3Places;
  } catch (error: any) {
    console.error('[SessionUtils] Error generating places:', error.message);
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

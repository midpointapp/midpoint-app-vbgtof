
import { supabase } from '@/app/integrations/supabase/client';
import { searchNearbyPlaces, calculateMidpoint } from './locationUtils';
import { Share, Platform, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';

interface Place {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  distance: number;
  placeId?: string;
}

interface SessionPlace {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rank: number;
  rating: number;
  distance: number;
}

interface CreateSessionParams {
  category: string;
  senderLat: number;
  senderLng: number;
  phoneNumber?: string;
  recipientName?: string;
}

/**
 * Generate session URL with sessionId and token
 */
export function generateSessionUrl(sessionId: string, token: string): string {
  const baseUrl = 'https://web-midpoint-app-vbgtof.natively.dev';
  return `${baseUrl}/?sessionId=${sessionId}&token=${token}`;
}

/**
 * Create a new meet session and send invite
 * Session is created with status='waiting_for_receiver'
 * Places are NOT generated until receiver joins
 */
export async function createSessionAndSendInvite(params: CreateSessionParams): Promise<string | null> {
  const { category, senderLat, senderLng, phoneNumber, recipientName } = params;

  try {
    console.log('[SessionUtils] Creating session with params:', { category, senderLat, senderLng });

    // Create session in Supabase
    const { data: sessionData, error: insertError } = await supabase
      .from('meet_sessions')
      .insert([
        {
          category,
          sender_lat: senderLat,
          sender_lng: senderLng,
          status: 'waiting_for_receiver',
        },
      ])
      .select()
      .single();

    if (insertError || !sessionData) {
      console.error('[SessionUtils] Error creating session:', insertError);
      throw new Error('Failed to create session');
    }

    const sessionId = sessionData.id;
    const inviteToken = sessionData.invite_token;
    console.log('[SessionUtils] Session created with ID:', sessionId);

    // Generate session URL with token
    const sessionUrl = generateSessionUrl(sessionId, inviteToken);

    // Send invite
    await sendSessionInvite(sessionUrl, phoneNumber, recipientName);

    return sessionId;
  } catch (error) {
    console.error('[SessionUtils] Error in createSessionAndSendInvite:', error);
    throw error;
  }
}

/**
 * Send session invite via Share API or clipboard
 */
async function sendSessionInvite(
  sessionUrl: string,
  phoneNumber?: string,
  recipientName?: string
): Promise<void> {
  const message = recipientName
    ? `Hey ${recipientName}! I'd like to meet you halfway. Open this link to share your location and find our meeting spot:\n\n${sessionUrl}`
    : `Hey! I'd like to meet you halfway. Open this link to share your location and find our meeting spot:\n\n${sessionUrl}`;

  console.log('[SessionUtils] Sending invite with URL:', sessionUrl);

  if (Platform.OS === 'web') {
    // Web: Copy to clipboard and show alert
    try {
      await Clipboard.setStringAsync(sessionUrl);
      Alert.alert(
        'Link Copied!',
        'The session invite link has been copied to your clipboard. Paste it in a message to share.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('[SessionUtils] Error copying to clipboard:', error);
      Alert.alert('Error', 'Failed to copy link. Please try again.');
    }
  } else {
    // iOS/Android: Use Share API
    try {
      const shareResult = await Share.share({
        message: message,
        title: 'MidPoint Session Invite',
      });

      console.log('[SessionUtils] Share result:', shareResult);

      if (shareResult.action === Share.sharedAction) {
        console.log('[SessionUtils] Share completed successfully');
      } else if (shareResult.action === Share.dismissedAction) {
        console.log('[SessionUtils] Share dismissed');
      }
    } catch (error) {
      console.error('[SessionUtils] Error sharing:', error);
      Alert.alert('Error', 'Failed to share link. Please try again.');
    }
  }
}

/**
 * Generate exactly 3 meeting place options near the midpoint
 * Called AFTER receiver joins and provides location
 */
export async function generateMidpointPlaces(
  sessionId: string,
  senderLat: number,
  senderLng: number,
  receiverLat: number,
  receiverLng: number,
  category: string
): Promise<SessionPlace[]> {
  try {
    console.log('[SessionUtils] Generating midpoint places for session:', sessionId);

    // Calculate midpoint
    const { midLat, midLng } = calculateMidpoint(
      senderLat,
      senderLng,
      receiverLat,
      receiverLng,
      false
    );

    console.log('[SessionUtils] Midpoint calculated:', { midLat, midLng });

    // Search for places
    let foundPlaces: Place[] = [];
    
    try {
      foundPlaces = await searchNearbyPlaces(midLat, midLng, category);
      console.log('[SessionUtils] Found places:', foundPlaces.length);
    } catch (searchError) {
      console.error('[SessionUtils] Error searching places:', searchError);
      // Continue with empty results rather than failing
    }

    // Ensure unique places (by placeId)
    const uniquePlaces = foundPlaces.filter((place, index, self) =>
      index === self.findIndex((p) => p.placeId === place.placeId)
    );

    // Take exactly 3 results (or fewer if not available)
    const finalPlaces = uniquePlaces.slice(0, 3);

    if (finalPlaces.length === 0) {
      console.warn('[SessionUtils] No places found near midpoint');
      return [];
    }

    console.log('[SessionUtils] Final places count:', finalPlaces.length);

    // Save places to session_places table
    const sessionPlaces: SessionPlace[] = finalPlaces.map((place, index) => ({
      place_id: place.placeId || place.id,
      name: place.name,
      address: place.address,
      lat: place.latitude,
      lng: place.longitude,
      rank: index + 1,
      rating: place.rating || 0,
      distance: place.distance || 0,
    }));

    // Insert all places
    const { error: insertError } = await supabase
      .from('session_places')
      .insert(
        sessionPlaces.map(place => ({
          session_id: sessionId,
          ...place,
        }))
      );

    if (insertError) {
      console.error('[SessionUtils] Error inserting session places:', insertError);
      throw new Error('Failed to save meeting places');
    }

    console.log('[SessionUtils] Session places saved successfully');

    return sessionPlaces;
  } catch (error) {
    console.error('[SessionUtils] Error in generateMidpointPlaces:', error);
    throw error;
  }
}

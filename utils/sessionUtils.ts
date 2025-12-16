
import { supabase } from '@/app/integrations/supabase/client';
import { searchNearbyPlaces, calculateMidpoint } from './locationUtils';
import { generateSessionUrl } from '@/constants/config';
import * as SMS from 'expo-sms';
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

interface CreateSessionParams {
  type: string;
  senderLat: number;
  senderLng: number;
  phoneNumber?: string;
  recipientName?: string;
}

/**
 * Create a new meet session and send SMS invite
 * Generates 1-3 unique midpoint places for the chosen category
 * Expands radius once if fewer than 1 result found
 */
export async function createSessionAndSendInvite(params: CreateSessionParams): Promise<string | null> {
  const { type, senderLat, senderLng, phoneNumber, recipientName } = params;

  try {
    console.log('[SessionUtils] Creating session with params:', { type, senderLat, senderLng });

    // Create session in Supabase
    const { data: sessionData, error: insertError } = await supabase
      .from('meet_sessions')
      .insert([
        {
          type,
          sender_lat: senderLat,
          sender_lng: senderLng,
          status: 'pending',
          radius_meters: 5000, // Start with 5km radius
        },
      ])
      .select()
      .single();

    if (insertError || !sessionData) {
      console.error('[SessionUtils] Error creating session:', insertError);
      throw new Error('Failed to create session');
    }

    const sessionId = sessionData.id;
    console.log('[SessionUtils] Session created with ID:', sessionId);

    // Generate session URL
    const sessionUrl = generateSessionUrl(sessionId);

    // Send SMS invite
    await sendSessionInvite(sessionUrl, phoneNumber, recipientName);

    return sessionId;
  } catch (error) {
    console.error('[SessionUtils] Error in createSessionAndSendInvite:', error);
    throw error;
  }
}

/**
 * Send session invite via SMS or Share API
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
 * Generate midpoint places for a session
 * Returns 1-3 unique results, expands radius once if needed
 */
export async function generateMidpointPlaces(
  sessionId: string,
  senderLat: number,
  senderLng: number,
  receiverLat: number,
  receiverLng: number,
  type: string,
  initialRadius: number = 5000
): Promise<Place[]> {
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

    // Search for places with initial radius
    let foundPlaces: Place[] = [];
    let currentRadius = initialRadius;
    const maxRadius = initialRadius * 2;

    try {
      foundPlaces = await searchNearbyPlaces(midLat, midLng, type);
      console.log('[SessionUtils] Found places with initial radius:', foundPlaces.length);

      // If fewer than 1 result, expand radius once
      if (foundPlaces.length < 1 && currentRadius < maxRadius) {
        console.log('[SessionUtils] Expanding search radius to:', maxRadius);
        currentRadius = maxRadius;
        foundPlaces = await searchNearbyPlaces(midLat, midLng, type);
        console.log('[SessionUtils] Found places with expanded radius:', foundPlaces.length);
      }
    } catch (searchError) {
      console.error('[SessionUtils] Error searching places:', searchError);
      // Continue with empty results rather than failing
    }

    // Ensure unique places (by placeId)
    const uniquePlaces = foundPlaces.filter((place, index, self) =>
      index === self.findIndex((p) => p.placeId === place.placeId)
    );

    // Return 1-3 results
    const finalPlaces = uniquePlaces.slice(0, 3);

    if (finalPlaces.length === 0) {
      console.warn('[SessionUtils] No places found even after expanding radius');
    }

    console.log('[SessionUtils] Final places count:', finalPlaces.length);

    // Update session with results
    const { error: updateError } = await supabase
      .from('meet_sessions')
      .update({
        results_json: finalPlaces,
        radius_meters: currentRadius,
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('[SessionUtils] Error updating session with results:', updateError);
    }

    return finalPlaces;
  } catch (error) {
    console.error('[SessionUtils] Error in generateMidpointPlaces:', error);
    throw error;
  }
}

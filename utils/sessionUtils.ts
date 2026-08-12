import { Alert, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { searchNearbyPlaces, Place, calculateDynamicRadius } from './locationUtils';
import { createSecureSession } from './sessionApi';

export async function createSessionAndSendInvite(category: string, senderLat: number, senderLng: number) {
  try {
    const { session: sessionData, token: inviteToken } = await createSecureSession(category, senderLat, senderLng);
    const sessionId = sessionData.id;
    const joinCode = sessionData.join_code;
    const deepLink = `https://kjlbcgjvruyrqvkdtljz.supabase.co/functions/v1/join?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(inviteToken)}`;
    const message = `Join me on MidPoint Meet! 📍\n\n${deepLink}\n\nOr enter code: ${joinCode}`;

    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(message);
      Alert.alert('Copied!', `Invite link copied to clipboard.\n\nCode: ${joinCode}`);
    } else {
      await Share.share({ message });
    }

    // The token is intentionally kept client-side only for this session and is
    // never returned by the secure read API.
    return { ...sessionData, invite_token: inviteToken, join_code: joinCode };
  } catch (error: any) {
    console.error('[SessionUtils] Failed to create session:', error?.message || 'unknown error');
    throw error;
  }
}

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
    ) return [];

    const midLat = (senderLat + receiverLat) / 2;
    const midLng = (senderLng + receiverLng) / 2;
    if (isNaN(midLat) || isNaN(midLng)) return [];

    const radius = calculateDynamicRadius(senderLat, senderLng, receiverLat, receiverLng);
    let places = await searchNearbyPlaces(midLat, midLng, category, radius);
    if (places.length === 0) {
      places = await searchNearbyPlaces(midLat, midLng, category, Math.min(radius * 2, 50000));
    }
    return places.slice(0, 3);
  } catch {
    return [];
  }
}

/** Legacy path retained only so old imports compile. Direct database writes are disabled. */
export async function generateAndSaveMidpointPlaces(
  _sessionId: string,
  senderLat: number,
  senderLng: number,
  receiverLat: number,
  receiverLng: number,
  category: string
) {
  return generateMidpointPlaces(senderLat, senderLng, receiverLat, receiverLng, category);
}

export async function shareInviteUrl(url: string) {
  if (Platform.OS === 'web') {
    await Clipboard.setStringAsync(url);
    Alert.alert('Link Copied', 'Share it with your contact!');
  } else {
    await Share.share({ message: url });
  }
}


import { supabase } from '@/app/integrations/supabase/client';
import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { generateMidpointPlaces } from './locationUtils';

const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_BASE_URL || 'https://web-midpoint-app-vbgtof.natively.dev';

console.log('[SessionUtils] Web base URL:', WEB_BASE_URL);

/**
 * Generate a secure random token for session invites
 */
function generateInviteToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Parse error message to provide user-friendly feedback
 */
function parseErrorMessage(error: any): string {
  const errorStr = JSON.stringify(error, null, 2);
  console.error('[SessionUtils] Full error details:', errorStr);

  // Check for specific error patterns
  if (error.message) {
    const msg = error.message.toLowerCase();
    
    // Paused/inactive project
    if (msg.includes('paused') || msg.includes('inactive') || msg.includes('project is not active')) {
      return 'The database is temporarily unavailable. Please contact support or try again later.';
    }
    
    // Network errors
    if (msg.includes('network') || msg.includes('fetch failed') || msg.includes('connection')) {
      return 'No internet connection. Please check your network and try again.';
    }
    
    // Timeout errors
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return 'Request timed out. Please check your connection and try again.';
    }
    
    // Auth errors
    if (msg.includes('jwt') || msg.includes('unauthorized') || msg.includes('forbidden')) {
      return 'Authentication error. Please restart the app and try again.';
    }
    
    // Database errors
    if (msg.includes('relation') || msg.includes('does not exist') || msg.includes('table')) {
      return 'Database configuration error. Please contact support.';
    }
  }

  // Generic database error
  if (error.code || error.details) {
    return 'Server error. Please try again in a moment.';
  }

  return error.message || 'An unexpected error occurred. Please try again.';
}

/**
 * Create a session and send invite with retry logic
 */
export async function createSessionAndSendInvite(
  category: string,
  senderLat: number,
  senderLng: number,
  retryCount = 0
): Promise<{ sessionId: string; inviteUrl: string }> {
  console.log('[SessionUtils] Creating session:', { 
    category, 
    senderLat, 
    senderLng, 
    retryCount,
    timestamp: new Date().toISOString()
  });

  try {
    // Generate secure token
    const inviteToken = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    console.log('[SessionUtils] Inserting session into Supabase...');
    console.log('[SessionUtils] Data:', {
      category,
      sender_lat: senderLat,
      sender_lng: senderLng,
      status: 'waiting_for_receiver',
      expires_at: expiresAt.toISOString(),
    });

    // Insert session into Supabase
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        category,
        sender_lat: senderLat,
        sender_lng: senderLng,
        status: 'waiting_for_receiver',
        invite_token: inviteToken,
        expires_at: expiresAt.toISOString(),
      })
      .select('*')
      .single();

    if (sessionError) {
      console.error('[SessionUtils] Supabase error:', JSON.stringify(sessionError, null, 2));
      throw sessionError;
    }

    if (!sessionData) {
      console.error('[SessionUtils] No session data returned');
      throw new Error('Failed to create session: No data returned from database');
    }

    console.log('[SessionUtils] ✅ Session created successfully:', sessionData.id);

    // Generate invite URL using stable web base URL
    const inviteUrl = `${WEB_BASE_URL}/?sessionId=${sessionData.id}&token=${inviteToken}`;
    console.log('[SessionUtils] Invite URL generated:', inviteUrl);

    return {
      sessionId: sessionData.id,
      inviteUrl,
    };

  } catch (error: any) {
    console.error('[SessionUtils] ❌ Error creating session:', {
      error: error,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      retryCount,
    });

    // Retry once on network failure (but not on database/auth errors)
    const shouldRetry = retryCount === 0 && 
      error.message && 
      (error.message.includes('Network') || 
       error.message.includes('fetch') || 
       error.message.includes('timeout'));

    if (shouldRetry) {
      console.log('[SessionUtils] Retrying session creation in 1 second...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return createSessionAndSendInvite(category, senderLat, senderLng, 1);
    }

    // Parse and throw user-friendly error
    const userMessage = parseErrorMessage(error);
    throw new Error(userMessage);
  }
}

/**
 * Share invite URL via native share or clipboard
 */
export async function shareInviteUrl(inviteUrl: string): Promise<void> {
  console.log('[SessionUtils] Sharing invite URL:', inviteUrl);
  
  try {
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(inviteUrl);
      console.log('[SessionUtils] ✅ Invite URL copied to clipboard');
    } else {
      const result = await Share.share({
        message: `Join me on MidPoint! ${inviteUrl}`,
        url: inviteUrl,
      });
      console.log('[SessionUtils] ✅ Share result:', result);
    }
  } catch (error) {
    console.error('[SessionUtils] ❌ Error sharing invite:', error);
    throw new Error('Failed to share invite');
  }
}

/**
 * Generate meeting places for a session
 */
export { generateMidpointPlaces };

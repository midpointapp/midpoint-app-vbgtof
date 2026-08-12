import { supabase } from '@/app/integrations/supabase/client';

export type SessionApiAction =
  | 'create'
  | 'get'
  | 'receiver_location'
  | 'set_status'
  | 'save_places';

async function callSessionApi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('session-api', { body });
  if (error) throw new Error(error.message || 'Secure session request failed');
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function createSecureSession(type: string, senderLat: number, senderLng: number) {
  return callSessionApi<{ session: any; token: string }>({ action: 'create', type, senderLat, senderLng });
}

export async function getSecureSession(sessionId: string, token: string) {
  return callSessionApi<{ session: any; places: any[] }>({ action: 'get', sessionId, token });
}

export async function setReceiverLocation(sessionId: string, token: string, lat: number, lng: number) {
  return callSessionApi<{ ok: true }>({ action: 'receiver_location', sessionId, token, lat, lng });
}

export async function setSecureSessionStatus(
  sessionId: string,
  token: string,
  status: 'connected' | 'proposed' | 'confirmed' | 'no_places_found',
  options: { placeId?: string; clearProposal?: boolean } = {},
) {
  return callSessionApi<{ ok: true }>({ action: 'set_status', sessionId, token, status, ...options });
}

export async function saveSecurePlaces(sessionId: string, token: string, places: any[]) {
  return callSessionApi<{ ok: true }>({ action: 'save_places', sessionId, token, places });
}

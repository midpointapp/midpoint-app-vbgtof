
import { supabase } from '@/app/integrations/supabase/client';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState, useEffect, useRef } from 'react';
import { generateMidpointPlaces } from '@/utils/sessionUtils';
import * as Clipboard from 'expo-clipboard';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { Share } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';

interface SessionPlace {
  id: string;
  session_id: string;
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rank: number;
}

interface MeetSession {
  id: string;
  type: string;
  sender_lat: number;
  sender_lng: number;
  receiver_lat: number | null;
  receiver_lng: number | null;
  status: 'waiting_for_receiver' | 'connected' | 'proposed' | 'confirmed' | 'expired';
  invite_token: string;
  expires_at: string;
  proposed_place_id: string | null;
  confirmed_place_id: string | null;
  created_at: string;
}

export default function SessionScreen() {
  const params = useLocalSearchParams();
  const sessionId = params.sessionId as string;
  const inviteToken = params.token as string;
  const router = useRouter();
  const colors = useThemeColors();

  const [session, setSession] = useState<MeetSession | null>(null);
  const [places, setPlaces] = useState<SessionPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('Session ID missing');
      setLoading(false);
      return;
    }

    console.log('[Session] Loading session:', sessionId);
    loadSession(sessionId, inviteToken);

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel(`session:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meet_sessions', filter: `id=eq.${sessionId}` }, (payload) => {
        console.log('[Session] Realtime update:', payload);
        setSession(payload.new as MeetSession);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'session_places', filter: `session_id=eq.${sessionId}` }, () => {
        loadSessionPlaces(sessionId);
      })
      .subscribe();

    channelRef.current = channel;
  }, [sessionId, session]);

  async function loadSession(id: string, token: string | null) {
    try {
      const { data, error } = await supabase
        .from('meet_sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw new Error(error.message);
      if (!data) throw new Error('Session not found');

      console.log('[Session] Loaded:', data);
      setSession(data);

      await loadSessionPlaces(id);

      if (data.status === 'waiting_for_receiver' && !data.receiver_lat) {
        await captureReceiverLocation(id, data);
      } else if (data.status === 'connected' && data.receiver_lat && data.sender_lat) {
        await generatePlaces(id, data);
      }

      setLoading(false);
    } catch (err: any) {
      console.error('[Session] Load error:', err.message);
      setError(err.message);
      setLoading(false);
    }
  }

  async function loadSessionPlaces(id: string) {
    const { data, error } = await supabase
      .from('session_places')
      .select('*')
      .eq('session_id', id)
      .order('rank', { ascending: true });

    if (error) {
      console.error('[Session] Places load error:', error.message);
      return;
    }

    console.log('[Session] Loaded', data?.length || 0, 'places');
    setPlaces(data || []);
  }

  async function captureReceiverLocation(id: string, sessionData: MeetSession) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});

      const { error } = await supabase
        .from('meet_sessions')
        .update({
          receiver_lat: loc.coords.latitude,
          receiver_lng: loc.coords.longitude,
          status: 'connected',
        })
        .eq('id', id);

      if (error) throw new Error(error.message);

      console.log('[Session] ✅ Receiver location captured');
    } catch (err: any) {
      console.error('[Session] Receiver location error:', err.message);
    }
  }

  async function generatePlaces(id: string, sessionData: MeetSession) {
    if (!sessionData.receiver_lat || !sessionData.receiver_lng) return;

    console.log('[Session] Generating places...');

    const results = await generateMidpointPlaces(
      id,
      sessionData.sender_lat,
      sessionData.sender_lng,
      sessionData.receiver_lat,
      sessionData.receiver_lng,
      sessionData.type
    );

    if (results.length > 0) {
      await loadSessionPlaces(id);
    }
  }

  async function handleProposePlace(place: SessionPlace) {
    const { error } = await supabase
      .from('meet_sessions')
      .update({ proposed_place_id: place.place_id, status: 'proposed' })
      .eq('id', sessionId);

    if (error) {
      Alert.alert('Error', error.message);
    }
  }

  async function handleAgreePlace() {
    const { error } = await supabase
      .from('meet_sessions')
      .update({ confirmed_place_id: session?.proposed_place_id, status: 'confirmed' })
      .eq('id', sessionId);

    if (error) {
      Alert.alert('Error', error.message);
    }
  }

  async function handleDenyPlace() {
    const { error } = await supabase
      .from('meet_sessions')
      .update({ proposed_place_id: null, status: 'connected' })
      .eq('id', sessionId);

    if (error) {
      Alert.alert('Error', error.message);
    }
  }

  function handleGetDirections(place: SessionPlace) {
    const url = Platform.select({
      ios: `maps://app?daddr=${place.lat},${place.lng}`,
      android: `geo:0,0?q=${place.lat},${place.lng}(${place.name})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`,
    });
    Linking.openURL(url!);
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.button}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Session: {session?.type}</Text>
      <Text style={[styles.status, { color: colors.text }]}>Status: {session?.status}</Text>

      {session?.status === 'waiting_for_receiver' && (
        <Text style={[styles.info, { color: colors.text }]}>Waiting for receiver to join...</Text>
      )}

      {places.length > 0 && (
        <View style={styles.placesContainer}>
          <Text style={[styles.subtitle, { color: colors.text }]}>Meeting Place Options ({places.length})</Text>
          {places.map((place, index) => (
            <View key={place.place_id} style={[styles.placeCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.placeName, { color: colors.text }]}>{place.name}</Text>
              <Text style={[styles.placeAddress, { color: colors.text }]}>{place.address}</Text>
              <View style={styles.placeActions}>
                <TouchableOpacity onPress={() => handleProposePlace(place)} style={styles.button}>
                  <Text style={styles.buttonText}>Propose</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleGetDirections(place)} style={styles.button}>
                  <Text style={styles.buttonText}>Directions</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {session?.status === 'proposed' && session.proposed_place_id && (
        <View style={styles.proposalActions}>
          <TouchableOpacity onPress={handleAgreePlace} style={[styles.button, styles.agreeButton]}>
            <Text style={styles.buttonText}>✅ Agree</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDenyPlace} style={[styles.button, styles.denyButton]}>
            <Text style={styles.buttonText}>❌ Deny</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  status: { fontSize: 16, marginBottom: 20 },
  info: { fontSize: 14, marginBottom: 20 },
  errorText: { fontSize: 16, textAlign: 'center', marginTop: 50 },
  subtitle: { fontSize: 18, fontWeight: '600', marginBottom: 15 },
  placesContainer: { marginTop: 20 },
  placeCard: { padding: 15, borderRadius: 12, marginBottom: 12 },
  placeName: { fontSize: 16, fontWeight: '600', marginBottom: 5 },
  placeAddress: { fontSize: 14, marginBottom: 10 },
  placeActions: { flexDirection: 'row', gap: 10 },
  button: { backgroundColor: '#007AFF', padding: 10, borderRadius: 8, flex: 1, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  proposalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  agreeButton: { backgroundColor: '#34C759' },
  denyButton: { backgroundColor: '#FF3B30' },
});

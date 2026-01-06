
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import { Share } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from '@/app/integrations/supabase/client';
import { generateMidpointPlaces } from '@/utils/sessionUtils';
import * as Clipboard from 'expo-clipboard';
import React, { useState, useEffect, useRef } from 'react';

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
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  // Parse params - handle both string and array cases
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  console.log('[Session] Component mounted');
  console.log('[Session] URL params read:', { sessionId, token, rawParams: params });
  
  const [session, setSession] = useState<MeetSession | null>(null);
  const [places, setPlaces] = useState<SessionPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSender, setIsSender] = useState(false);

  // Validate params on mount
  useEffect(() => {
    if (!sessionId) {
      console.error('[Session] Missing sessionId in URL - validation failed');
      setError('Invalid session link. The URL is missing required parameters. Please check the link and try again.');
      setLoading(false);
      return;
    }

    console.log('[Session] Fetch start - loading session:', sessionId);
    loadSession(sessionId, token || null);
  }, [sessionId, token]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!sessionId || !session) return;

    console.log('[Session] Setting up realtime subscription for session:', sessionId);

    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meet_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('[Session] Realtime update received:', payload);
          if (payload.new) {
            setSession(payload.new as MeetSession);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_places',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          console.log('[Session] Places update received:', payload);
          await loadSessionPlaces(sessionId);
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      console.log('[Session] Cleaning up realtime subscription');
      channel.unsubscribe();
    };
  }, [sessionId, session]);

  const loadSession = async (id: string, accessToken: string | null) => {
    try {
      console.log('[Session] Fetch start - fetching session data from Supabase...');
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('meet_sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('[Session] Fetch fail - Supabase error:', fetchError);
        throw new Error(fetchError.message);
      }

      if (!data) {
        console.error('[Session] Fetch fail - session not found in database');
        throw new Error('Session not found');
      }

      console.log('[Session] Fetch success - session loaded:', data);

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        console.error('[Session] Session expired:', data.expires_at);
        setError('This session has expired. Please create a new meeting session.');
        setLoading(false);
        return;
      }

      // Validate token if provided
      if (accessToken && data.invite_token !== accessToken) {
        console.error('[Session] Invalid access token provided');
        setError('Invalid access token. You do not have permission to view this session.');
        setLoading(false);
        return;
      }

      setSession(data);

      // Determine if current user is sender or receiver
      // For now, assume if receiver_lat is null, we're the receiver
      const isReceiver = !data.receiver_lat;
      setIsSender(!isReceiver);

      console.log('[Session] User role determined:', isReceiver ? 'receiver' : 'sender');

      // Load places if they exist
      await loadSessionPlaces(id);

      // If receiver and no location captured yet, capture it
      if (isReceiver && !data.receiver_lat) {
        await captureReceiverLocation(id, data);
      }

      // If both locations present and no places yet, generate them
      if (data.sender_lat && data.receiver_lat && places.length === 0) {
        await generatePlaces(id, data);
      }

      console.log('[Session] Session load complete');
      setLoading(false);
    } catch (err: any) {
      console.error('[Session] Fetch fail - error loading session:', err);
      setError(err.message || 'Failed to load session. Please check your connection and try again.');
      setLoading(false);
    }
  };

  const loadSessionPlaces = async (id: string) => {
    try {
      console.log('[Session] Loading places for session:', id);
      const { data, error } = await supabase
        .from('session_places')
        .select('*')
        .eq('session_id', id)
        .order('rank', { ascending: true });

      if (error) {
        console.error('[Session] Places fetch error:', error);
        return;
      }

      console.log('[Session] Places loaded:', data?.length || 0);
      setPlaces(data || []);
    } catch (err) {
      console.error('[Session] Load places failed:', err);
    }
  };

  const captureReceiverLocation = async (id: string, sessionData: MeetSession) => {
    try {
      console.log('[Session] Requesting receiver location...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is needed to find a meeting point.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      console.log('[Session] Receiver location captured:', location.coords);

      const { error } = await supabase
        .from('meet_sessions')
        .update({
          receiver_lat: location.coords.latitude,
          receiver_lng: location.coords.longitude,
          status: 'connected',
        })
        .eq('id', id);

      if (error) {
        console.error('[Session] Update receiver location error:', error);
        throw error;
      }

      console.log('[Session] Receiver location saved');

      // Trigger place generation
      await generatePlaces(id, {
        ...sessionData,
        receiver_lat: location.coords.latitude,
        receiver_lng: location.coords.longitude,
      });
    } catch (err) {
      console.error('[Session] Capture location failed:', err);
      Alert.alert('Error', 'Failed to capture location');
    }
  };

  const generatePlaces = async (id: string, sessionData: MeetSession) => {
    if (!sessionData.sender_lat || !sessionData.receiver_lat) {
      console.log('[Session] Cannot generate places - missing coordinates');
      return;
    }

    try {
      console.log('[Session] Generating places...');
      const generatedPlaces = await generateMidpointPlaces(
        sessionData.sender_lat,
        sessionData.sender_lng,
        sessionData.receiver_lat,
        sessionData.receiver_lng,
        sessionData.type
      );

      console.log('[Session] Places generated:', generatedPlaces.length);

      if (generatedPlaces.length === 0) {
        console.warn('[Session] No places found');
        return;
      }

      // Save to database
      const placesToInsert = generatedPlaces.slice(0, 3).map((place, index) => ({
        session_id: id,
        place_id: place.place_id || `place_${index}`,
        name: place.name,
        address: place.address || '',
        lat: place.latitude,
        lng: place.longitude,
        rank: index + 1,
      }));

      const { error } = await supabase
        .from('session_places')
        .insert(placesToInsert);

      if (error) {
        console.error('[Session] Insert places error:', error);
        throw error;
      }

      console.log('[Session] Places saved to DB');
      await loadSessionPlaces(id);
    } catch (err) {
      console.error('[Session] Generate places failed:', err);
    }
  };

  const handleProposePlace = async (place: SessionPlace) => {
    if (!session) return;

    try {
      const { error } = await supabase
        .from('meet_sessions')
        .update({
          proposed_place_id: place.place_id,
          status: 'proposed',
        })
        .eq('id', session.id);

      if (error) throw error;

      Alert.alert('Success', `Proposed: ${place.name}`);
    } catch (err) {
      console.error('[Session] Propose failed:', err);
      Alert.alert('Error', 'Failed to propose place');
    }
  };

  const handleAgreePlace = async () => {
    if (!session || !session.proposed_place_id) return;

    try {
      const { error } = await supabase
        .from('meet_sessions')
        .update({
          confirmed_place_id: session.proposed_place_id,
          status: 'confirmed',
        })
        .eq('id', session.id);

      if (error) throw error;

      Alert.alert('Confirmed!', 'Meeting place confirmed');
    } catch (err) {
      console.error('[Session] Agree failed:', err);
      Alert.alert('Error', 'Failed to confirm place');
    }
  };

  const handleDenyPlace = async () => {
    if (!session) return;

    try {
      const { error } = await supabase
        .from('meet_sessions')
        .update({
          proposed_place_id: null,
          status: 'connected',
        })
        .eq('id', session.id);

      if (error) throw error;
    } catch (err) {
      console.error('[Session] Deny failed:', err);
      Alert.alert('Error', 'Failed to deny proposal');
    }
  };

  const handleGetDirections = (place: SessionPlace) => {
    const url = Platform.select({
      ios: `maps://app?daddr=${place.lat},${place.lng}`,
      android: `google.navigation:q=${place.lat},${place.lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`,
    });

    Linking.openURL(url!);
  };

  // Error state
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Session Error</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/(home)/')}
          >
            <Text style={styles.buttonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading session...</Text>
      </View>
    );
  }

  if (!session) {
    return null;
  }

  const proposedPlace = places.find((p) => p.place_id === session.proposed_place_id);
  const confirmedPlace = places.find((p) => p.place_id === session.confirmed_place_id);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {session.type} Meetup
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Status: {session.status.replace(/_/g, ' ')}
          </Text>
        </View>

        {/* Waiting state */}
        {session.status === 'waiting_for_receiver' && (
          <View style={styles.statusCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              Waiting for other person to share location...
            </Text>
          </View>
        )}

        {/* Places list */}
        {places.length > 0 && session.status !== 'confirmed' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Meeting Place Options ({places.length})
            </Text>
            {places.map((place) => (
              <View key={place.id} style={[styles.placeCard, { backgroundColor: colors.card }]}>
                <View style={styles.placeInfo}>
                  <Text style={[styles.placeName, { color: colors.text }]}>{place.name}</Text>
                  <Text style={[styles.placeAddress, { color: colors.textSecondary }]}>
                    {place.address}
                  </Text>
                </View>
                <View style={styles.placeActions}>
                  {isSender && session.status === 'connected' && (
                    <TouchableOpacity
                      style={[styles.proposeButton, { backgroundColor: colors.primary }]}
                      onPress={() => handleProposePlace(place)}
                    >
                      <Text style={styles.buttonText}>Propose</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.directionsButton, { borderColor: colors.primary }]}
                    onPress={() => handleGetDirections(place)}
                  >
                    <MaterialIcons name="directions" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Proposed place */}
        {session.status === 'proposed' && proposedPlace && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Proposed Meeting Place</Text>
            <View style={[styles.placeCard, styles.proposedCard, { backgroundColor: colors.card }]}>
              <View style={styles.placeInfo}>
                <Text style={[styles.placeName, { color: colors.text }]}>{proposedPlace.name}</Text>
                <Text style={[styles.placeAddress, { color: colors.textSecondary }]}>
                  {proposedPlace.address}
                </Text>
              </View>
              {!isSender && (
                <View style={styles.proposalActions}>
                  <TouchableOpacity
                    style={[styles.agreeButton, { backgroundColor: colors.success }]}
                    onPress={handleAgreePlace}
                  >
                    <Text style={styles.buttonText}>Agree</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.denyButton, { backgroundColor: colors.error }]}
                    onPress={handleDenyPlace}
                  >
                    <Text style={styles.buttonText}>Deny</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Confirmed place */}
        {session.status === 'confirmed' && confirmedPlace && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>✅ Confirmed Meeting Place</Text>
            <View style={[styles.placeCard, styles.confirmedCard, { backgroundColor: colors.card }]}>
              <View style={styles.placeInfo}>
                <Text style={[styles.placeName, { color: colors.text }]}>{confirmedPlace.name}</Text>
                <Text style={[styles.placeAddress, { color: colors.textSecondary }]}>
                  {confirmedPlace.address}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={() => handleGetDirections(confirmedPlace)}
              >
                <MaterialIcons name="directions" size={20} color="#fff" />
                <Text style={styles.buttonText}>Get Directions</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingTop: 60,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  statusText: {
    fontSize: 16,
  },
  placeCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  proposedCard: {
    borderWidth: 2,
    borderColor: '#FFA500',
  },
  confirmedCard: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  placeInfo: {
    flex: 1,
    marginBottom: 12,
  },
  placeName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  placeAddress: {
    fontSize: 14,
  },
  placeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  proposeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  directionsButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  proposalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  agreeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  denyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
});

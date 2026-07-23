
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
import { SafeAreaView } from 'react-native-safe-area-context';
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
  status: 'waiting_for_receiver' | 'connected' | 'proposed' | 'confirmed' | 'expired' | 'no_places_found';
  invite_token: string;
  join_code?: string;
  expires_at: string;
  proposed_place_id: string | null;
  confirmed_place_id: string | null;
  created_at: string;
}

const CATEGORY_MAP: Record<string, string> = {
  coffee: '☕ Coffee',
  food: '🍔 Food',
  marketplace: '🛍️ Marketplace',
  gas: '⛽ Gas Station',
  park: '🌳 Park',
  police: '🚔 Police Station',
};

function getCategoryLabel(type: string): string {
  return CATEGORY_MAP[type] ?? type;
}

const STATUS_LABEL: Record<string, string> = {
  waiting_for_receiver: 'Waiting for other person...',
  connected: 'Both locations found — finding midpoint...',
  proposed: 'Place proposed — waiting for response',
  confirmed: 'Meeting confirmed!',
  expired: 'Session expired',
  no_places_found: 'No places found near the midpoint',
};

function getStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status.replace(/_/g, ' ');
}

export default function SessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const isSenderParam = Array.isArray(params.isSender) ? params.isSender[0] : params.isSender;

  const [session, setSession] = useState<MeetSession | null>(null);
  const [places, setPlaces] = useState<SessionPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSender, setIsSender] = useState(false);
  const placesGeneratedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setError('Invalid session link. The URL is missing the session ID. Please check the link and try again.');
      setLoading(false);
      return;
    }

    loadSession(sessionId, token || null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token]);

  useEffect(() => {
    if (!sessionId) return;

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
          console.log('[Session] Realtime update received:', payload.eventType);
          if (payload.new) {
            const updatedSession = payload.new as MeetSession;
            setSession(updatedSession);

            if (updatedSession.receiver_lat && updatedSession.sender_lat && !placesGeneratedRef.current) {
              generatePlaces(sessionId!, updatedSession);
            }
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
        async () => {
          await loadSessionPlaces(sessionId);
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const loadSession = async (id: string, accessToken: string | null) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('meet_sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (!data) {
        throw new Error('Session not found');
      }

      if (new Date(data.expires_at) < new Date()) {
        setError('This session has expired. Please create a new meeting session.');
        setLoading(false);
        return;
      }

      if (accessToken && data.invite_token !== accessToken) {
        setError('Invalid access token. You do not have permission to view this session.');
        setLoading(false);
        return;
      }

      setSession(data);

      const senderRole = isSenderParam === 'true';
      setIsSender(senderRole);

      await loadSessionPlaces(id);

      if (!senderRole && !data.receiver_lat) {
        await captureReceiverLocation(id, data);
      }

      if (data.sender_lat && data.receiver_lat) {
        await generatePlaces(id, data);
      }

      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load session. Please check your connection and try again.');
      setLoading(false);
    }
  };

  const loadSessionPlaces = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('session_places')
        .select('*')
        .eq('session_id', id)
        .order('rank', { ascending: true });

      if (error) return;

      setPlaces(data || []);
    } catch {
      // silently ignore
    }
  };

  const captureReceiverLocation = async (id: string, sessionData: MeetSession) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is needed to find a meeting point.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});

      const { error } = await supabase
        .from('meet_sessions')
        .update({
          receiver_lat: location.coords.latitude,
          receiver_lng: location.coords.longitude,
          status: 'connected',
        })
        .eq('id', id);

      if (error) throw error;

      await generatePlaces(id, {
        ...sessionData,
        receiver_lat: location.coords.latitude,
        receiver_lng: location.coords.longitude,
      });
    } catch {
      Alert.alert('Error', 'Failed to capture location');
    }
  };

  const generatePlaces = async (id: string, sessionData: MeetSession) => {
    if (!sessionData.sender_lat || !sessionData.receiver_lat) return;
    if (
      typeof sessionData.sender_lat !== 'number' ||
      typeof sessionData.sender_lng !== 'number' ||
      typeof sessionData.receiver_lat !== 'number' ||
      typeof sessionData.receiver_lng !== 'number'
    ) return;
    if (
      isNaN(sessionData.sender_lat) || isNaN(sessionData.sender_lng) ||
      isNaN(sessionData.receiver_lat) || isNaN(sessionData.receiver_lng)
    ) return;

    try {
      const generatedPlaces = await generateMidpointPlaces(
        sessionData.sender_lat,
        sessionData.sender_lng,
        sessionData.receiver_lat,
        sessionData.receiver_lng,
        sessionData.type
      );

      if (generatedPlaces.length === 0) {
        // Mark session as no_places_found so UI can show a message
        await supabase
          .from('meet_sessions')
          .update({ status: 'no_places_found' })
          .eq('id', id);
        return;
      }

      const placesToInsert = generatedPlaces.slice(0, 3).map((place, index) => ({
        session_id: id,
        place_id: place.placeId || `place_${index}`,
        name: place.name,
        address: place.address || '',
        lat: place.latitude,
        lng: place.longitude,
        rank: index + 1,
      }));

      const { error } = await supabase
        .from('session_places')
        .insert(placesToInsert);

      if (error) throw error;

      // Only mark as generated AFTER successful insert
      placesGeneratedRef.current = true;

      await loadSessionPlaces(id);
    } catch {
      // Reset ref so realtime can retry
      placesGeneratedRef.current = false;
    }
  };

  const handleProposePlace = async (place: SessionPlace) => {
    if (!session) return;
    console.log('[Session] Proposing place:', place.name);

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
    } catch {
      Alert.alert('Error', 'Failed to propose place');
    }
  };

  const handleAgreePlace = async () => {
    if (!session || !session.proposed_place_id) return;
    console.log('[Session] Agreeing to proposed place');

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
    } catch {
      Alert.alert('Error', 'Failed to confirm place');
    }
  };

  const handleDenyPlace = async () => {
    if (!session) return;
    console.log('[Session] Denying proposed place');

    try {
      const { error } = await supabase
        .from('meet_sessions')
        .update({
          proposed_place_id: null,
          status: 'connected',
        })
        .eq('id', session.id);

      if (error) throw error;
    } catch {
      Alert.alert('Error', 'Failed to deny proposal');
    }
  };

  const handleGetDirections = (place: SessionPlace) => {
    console.log('[Session] Opening directions for:', place.name);
    const url = Platform.select({
      ios: `maps://app?daddr=${place.lat},${place.lng}`,
      android: `google.navigation:q=${place.lat},${place.lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`,
    });

    Linking.openURL(url!);
  };

  if (error) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Session Error</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => {
              console.log('[Session] Navigating home from error state');
              router.push('/(tabs)/(home)/');
            }}
          >
            <Text style={styles.buttonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading session...</Text>
        <Text style={[styles.loadingSubtext, { color: colors.textSecondary }]}>
          {sessionId ? `Session ID: ${sessionId.substring(0, 8)}...` : 'Validating...'}
        </Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return null;
  }

  const proposedPlace = places.find((p) => p.place_id === session.proposed_place_id);
  const confirmedPlace = places.find((p) => p.place_id === session.confirmed_place_id);
  const categoryLabel = getCategoryLabel(session.type);
  const statusLabel = getStatusLabel(session.status);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              console.log('[Session] Back button pressed');
              router.back();
            }}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>
              {categoryLabel}
              {' Meetup'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        {/* Waiting state — merged card with join code */}
        {session.status === 'waiting_for_receiver' && (
          <View style={[styles.waitingCard, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="small" color={colors.primary} style={styles.waitingSpinner} />
            <Text style={[styles.waitingTitle, { color: colors.text }]}>Waiting for other person...</Text>
            <Text style={[styles.waitingHint, { color: colors.textSecondary }]}>
              Share the code below so they can join
            </Text>
            {isSender && session.join_code && (
              <>
                <Text style={[styles.joinCodeText, { color: colors.text }]}>{session.join_code}</Text>
                <Text style={[styles.joinCodeHint, { color: colors.textSecondary }]}>
                  Receiver enters this in the app
                </Text>
              </>
            )}
          </View>
        )}

        {/* No places found state */}
        {session.status === 'no_places_found' && (
          <View style={[styles.waitingCard, { backgroundColor: colors.card }]}>
            <MaterialIcons name="location-off" size={36} color={colors.textSecondary} />
            <Text style={[styles.waitingTitle, { color: colors.text }]}>No places found</Text>
            <Text style={[styles.waitingHint, { color: colors.textSecondary }]}>
              {'No '}
              {getCategoryLabel(session.type).toLowerCase()}
              {' spots were found near your midpoint. Try a different category or meet closer together.'}
            </Text>
          </View>
        )}

        {/* Places list */}
        {places.length > 0 && session.status !== 'confirmed' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {'Meeting Place Options'}
            </Text>
            {places.map((place) => {
              const badgeNum = String(place.rank);
              return (
                <View key={place.id} style={[styles.placeCard, { backgroundColor: colors.card }]}>
                  <View style={[styles.placeBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.placeBadgeText}>{badgeNum}</Text>
                  </View>
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
              );
            })}
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
            <View style={styles.confirmedHeader}>
              <View style={[styles.confirmedCheckCircle, { backgroundColor: colors.success }]}>
                <MaterialIcons name="check" size={36} color="#fff" />
              </View>
              <Text style={[styles.confirmedTitle, { color: colors.success }]}>Meeting Confirmed!</Text>
            </View>
            <View style={[styles.confirmedCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.placeName, { color: colors.text }]}>{confirmedPlace.name}</Text>
              <Text style={[styles.placeAddress, { color: colors.textSecondary }]}>
                {confirmedPlace.address}
              </Text>
              <TouchableOpacity
                style={[styles.directionsFullButton, { backgroundColor: colors.primary }]}
                onPress={() => handleGetDirections(confirmedPlace)}
              >
                <MaterialIcons name="directions" size={20} color="#fff" />
                <Text style={styles.buttonText}>Get Directions</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  waitingCard: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 16,
    marginBottom: 24,
  },
  waitingSpinner: {
    marginBottom: 12,
  },
  waitingTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  waitingHint: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  joinCodeText: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
  },
  joinCodeHint: {
    fontSize: 12,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  placeBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  placeBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  proposedCard: {
    borderWidth: 2,
    borderColor: '#FFA500',
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  placeAddress: {
    fontSize: 13,
  },
  placeActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  proposeButton: {
    paddingHorizontal: 14,
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
    marginTop: 12,
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
  confirmedHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmedCheckCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  confirmedTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  confirmedCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  directionsFullButton: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
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
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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

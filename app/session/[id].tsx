
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/styles/commonStyles';
import { secureSessionRequest, type SecureSessionResponse } from '@/utils/secureSessionApi';

interface MeetSession {
  id: string;
  type: string;
  receiver_location_shared?: boolean;
  status: string;
  join_code?: string;
  expires_at: string;
  proposed_place_id: string | null;
  confirmed_place_id: string | null;
}

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

const CATEGORY_LABELS: Record<string, string> = {
  coffee: '☕ Coffee',
  food: '🍔 Food',
  marketplace: '🛍️ Marketplace',
  gas: '⛽ Gas Station',
  park: '🌳 Park',
  police: '🚔 Police Station',
};

export default function ReceiverSessionScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { id, token } = useLocalSearchParams<{ id: string; token: string }>();

  const [session, setSession] = useState<MeetSession | null>(null);
  const [places, setPlaces] = useState<SessionPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationCaptured, setLocationCaptured] = useState(false);
  const baseUrl = process.env.EXPO_PUBLIC_SECURE_SUPABASE_URL;
  const callApi = useCallback(async (action: 'get' | 'receiver_location' | 'agree' | 'decline', extra: { lat?: number; lng?: number; placeId?: string } = {}): Promise<SecureSessionResponse> => {
    if (!baseUrl || !id || !token) throw new Error('Secure meeting service is not configured.');
    return secureSessionRequest({ action, sessionId: id, token, ...extra }, { baseUrl });
  }, [baseUrl, id, token]);
  const applyResponse = useCallback((response: SecureSessionResponse) => {
    if (response.session) setSession(response.session as unknown as MeetSession);
    if (response.places) setPlaces(response.places as unknown as SessionPlace[]);
  }, []);

  // Do not log invitation credentials.

  const captureReceiverLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Please enable location access so we can find your midpoint.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const response = await callApi('receiver_location', { lat: loc.coords.latitude, lng: loc.coords.longitude });
      applyResponse(response);
      setLocationCaptured(true);
    } catch {
      Alert.alert('Error', 'Unable to share location. Please try again.');
    }
  }, [callApi, applyResponse]);

  const loadSession = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await callApi('get');
      applyResponse(response);
      setError(null);
      if (response.session && !(response.session as MeetSession).receiver_location_shared && !locationCaptured) {
        await captureReceiverLocation();
      }
    } catch (err) {
      if (showLoading) setError(err instanceof Error ? err.message : 'Unable to load meeting');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [callApi, applyResponse, captureReceiverLocation, locationCaptured]);

  useEffect(() => {
    void loadSession(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token, baseUrl]);

  // Server-side authorization replaces unprotected Postgres changefeed subscriptions.
  // Poll only while the screen is mounted; do not expose meeting rows over Realtime.
  useEffect(() => {
    const interval = setInterval(() => { void loadSession(false); }, 5000);
    return () => clearInterval(interval);
  }, [loadSession]);

  const handleAgree = async (placeId: string) => {
    try {
      applyResponse(await callApi('agree', { placeId }));
    } catch {
      Alert.alert('Error', 'Could not confirm the meeting place. Please try again.');
    }
  };

  const handleDeny = async () => {
    if (!session?.proposed_place_id) return;
    try {
      applyResponse(await callApi('decline', { placeId: session.proposed_place_id }));
    } catch {
      Alert.alert('Error', 'Could not decline the place. Please try again.');
    }
  };

  const handleGetDirections = (place: SessionPlace) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
    console.log('[ReceiverSession] Get Directions pressed, opening maps:', url);
    Linking.openURL(url).catch((err) => console.error('[ReceiverSession] Error opening maps:', err));
  };

  const handleGoHome = () => {
    console.log('[ReceiverSession] Go Home pressed');
    router.replace('/(tabs)/(home)');
  };

  const categoryLabel = session ? (CATEGORY_LABELS[session.type] ?? session.type) : '';

  const proposedPlace = session?.proposed_place_id
    ? places.find((p) => p.place_id === session.proposed_place_id) ?? null
    : null;

  const confirmedPlace = session?.confirmed_place_id
    ? places.find((p) => p.place_id === session.confirmed_place_id) ?? null
    : null;

  const isWaiting =
    session &&
    (session.status === 'waiting_for_receiver' || session.status === 'connected') &&
    places.length === 0;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading session...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <MaterialIcons name="error-outline" size={56} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.goHomeButton, { backgroundColor: colors.primary }]}
          onPress={handleGoHome}
        >
          <Text style={styles.goHomeButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16 },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              console.log('[ReceiverSession] Back button pressed');
              router.back();
            }}
            style={[styles.backButton, { backgroundColor: colors.card }]}
          >
            <MaterialIcons name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.sessionTitle, { color: colors.text }]}>MidPoint Session</Text>
            <Text style={[styles.sessionCategory, { color: colors.primary }]}>{categoryLabel}</Text>
          </View>
        </View>

        {/* Waiting state */}
        {isWaiting && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
            <Text style={[styles.waitingTitle, { color: colors.text }]}>
              Waiting for midpoint to be calculated...
            </Text>
            <Text style={[styles.waitingHint, { color: colors.textSecondary }]}>
              {locationCaptured
                ? 'Your location has been shared. Hang tight!'
                : 'Sharing your location...'}
            </Text>
          </View>
        )}

        {/* Places list */}
        {places.length > 0 && session?.status !== 'proposed' && session?.status !== 'confirmed' && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Meeting Places</Text>
            {places.map((place, index) => (
              <React.Fragment key={place.id}>
                <View style={styles.placeItem}>
                  <View style={[styles.rankBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.rankText}>{place.rank}</Text>
                  </View>
                  <View style={styles.placeInfo}>
                    <Text style={[styles.placeName, { color: colors.text }]}>{place.name}</Text>
                    <Text style={[styles.placeAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                      {place.address}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleGetDirections(place)}
                    style={styles.directionsButton}
                  >
                    <MaterialIcons name="navigation" size={28} color={colors.accent} />
                  </TouchableOpacity>
                </View>
                {index < places.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                )}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* Proposed place — Agree / Deny */}
        {session?.status === 'proposed' && proposedPlace && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Proposed Meeting Place</Text>
            <View style={styles.proposedPlaceBox}>
              <MaterialIcons name="place" size={32} color={colors.primary} />
              <Text style={[styles.proposedPlaceName, { color: colors.text }]}>{proposedPlace.name}</Text>
              <Text style={[styles.proposedPlaceAddress, { color: colors.textSecondary }]}>
                {proposedPlace.address}
              </Text>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.agreeButton, { backgroundColor: colors.success }]}
                onPress={() => handleAgree(proposedPlace.place_id)}
              >
                <MaterialIcons name="check" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Agree</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.denyButton, { borderColor: colors.error }]}
                onPress={handleDeny}
              >
                <MaterialIcons name="close" size={20} color={colors.error} />
                <Text style={[styles.denyButtonText, { color: colors.error }]}>Deny</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Confirmed place */}
        {session?.status === 'confirmed' && confirmedPlace && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={[styles.confirmedBadge, { backgroundColor: colors.success + '20' }]}>
              <MaterialIcons name="check-circle" size={20} color={colors.success} />
              <Text style={[styles.confirmedBadgeText, { color: colors.success }]}>Meeting Confirmed!</Text>
            </View>
            <View style={styles.proposedPlaceBox}>
              <MaterialIcons name="place" size={32} color={colors.primary} />
              <Text style={[styles.proposedPlaceName, { color: colors.text }]}>{confirmedPlace.name}</Text>
              <Text style={[styles.proposedPlaceAddress, { color: colors.textSecondary }]}>
                {confirmedPlace.address}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.directionsFullButton, { backgroundColor: colors.accent }]}
              onPress={() => handleGetDirections(confirmedPlace)}
            >
              <MaterialIcons name="navigation" size={20} color="#fff" />
              <Text style={styles.directionsFullButtonText}>Get Directions</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* No places found */}
        {session?.status === 'no_places_found' && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <MaterialIcons name="location-off" size={36} color={colors.textSecondary} style={styles.centeredIcon} />
            <Text style={[styles.waitingTitle, { color: colors.text }]}>No places found</Text>
            <Text style={[styles.waitingHint, { color: colors.textSecondary }]}>
              No spots were found near your midpoint. Try a different category or meet closer together.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
  goHomeButton: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  goHomeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sessionCategory: {
    fontSize: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  spinner: {
    marginBottom: 12,
  },
  waitingTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  waitingHint: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  centeredIcon: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  placeAddress: {
    fontSize: 13,
    lineHeight: 18,
  },
  directionsButton: {
    padding: 4,
  },
  proposedPlaceBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  proposedPlaceName: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  proposedPlaceAddress: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  agreeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  denyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  denyButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  confirmedBadgeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  directionsFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  directionsFullButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

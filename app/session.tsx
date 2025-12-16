
import React, { useState, useEffect, useRef } from 'react';
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
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import * as Location from 'expo-location';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from '@/app/integrations/supabase/client';
import { calculateMidpoint, searchNearbyPlaces } from '@/utils/locationUtils';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

interface MeetSession {
  id: string;
  type: string;
  sender_lat: number;
  sender_lng: number;
  receiver_lat: number | null;
  receiver_lng: number | null;
  radius_meters: number;
  results_json: Place[];
  selected_place_id: string | null;
  status: 'pending' | 'receiver_joined' | 'selected';
  created_at: string;
}

export default function SessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<MeetSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [midpointAddress, setMidpointAddress] = useState<string | null>(null);
  const [isReceiver, setIsReceiver] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);

  // Extract sessionId from URL params
  useEffect(() => {
    const extractSessionId = () => {
      // Check URL params from expo-router
      if (params?.sessionId) {
        const id = Array.isArray(params.sessionId) 
          ? params.sessionId[0] 
          : params.sessionId;
        console.log('[Session] sessionId from params:', id);
        setSessionId(id);
        return;
      }

      // On web, also check window.location.search
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        const id = searchParams.get('sessionId');
        if (id) {
          console.log('[Session] sessionId from window.location:', id);
          setSessionId(id);
          return;
        }
      }

      // No sessionId found
      console.log('[Session] No sessionId found');
      setError('No session ID provided');
      setLoading(false);
    };

    extractSessionId();
  }, [params]);

  // Load session data when sessionId is available
  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!sessionId || !session) return;

    console.log('[Session] Subscribing to realtime updates for session:', sessionId);

    // Check if already subscribed
    if (channelRef.current?.state === 'subscribed') {
      console.log('[Session] Already subscribed');
      return;
    }

    const channel = supabase
      .channel(`session:${sessionId}`, {
        config: { private: true }
      })
      .on('broadcast', { event: 'UPDATE' }, (payload) => {
        console.log('[Session] Received realtime update:', payload);
        if (payload.new) {
          const updatedSession = payload.new as MeetSession;
          setSession(updatedSession);
          
          // Update places if results_json changed
          if (updatedSession.results_json && Array.isArray(updatedSession.results_json)) {
            setPlaces(updatedSession.results_json);
          }
        }
      })
      .subscribe((status) => {
        console.log('[Session] Subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        console.log('[Session] Unsubscribing from realtime updates');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId, session]);

  const loadSession = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      console.log('[Session] Loading session:', id);

      // Fetch session from Supabase
      const { data, error: fetchError } = await supabase
        .from('meet_sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !data) {
        console.error('[Session] Error loading session:', fetchError);
        setError('This session link is invalid or expired.');
        setLoading(false);
        return;
      }

      console.log('[Session] Session loaded:', data);
      const sessionData = data as MeetSession;
      setSession(sessionData);

      // Load places from results_json
      if (sessionData.results_json && Array.isArray(sessionData.results_json)) {
        setPlaces(sessionData.results_json);
      }

      // Check if this is the receiver (no receiver location yet)
      if (!sessionData.receiver_lat || !sessionData.receiver_lng) {
        console.log('[Session] This is the receiver, capturing location...');
        setIsReceiver(true);
        await captureReceiverLocation(id, sessionData);
      } else {
        // Both locations are set, calculate midpoint if not done yet
        if (sessionData.results_json && sessionData.results_json.length > 0) {
          // Results already exist, just display them
          const midLat = (sessionData.sender_lat + sessionData.receiver_lat) / 2;
          const midLng = (sessionData.sender_lng + sessionData.receiver_lng) / 2;
          await reverseGeocodeMidpoint(midLat, midLng);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('[Session] Error in loadSession:', err);
      setError('Failed to load session');
      setLoading(false);
    }
  };

  const captureReceiverLocation = async (id: string, sessionData: MeetSession) => {
    try {
      setUpdatingLocation(true);

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Please enable location access to join this session');
        setUpdatingLocation(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log('[Session] Captured receiver location:', location.coords);

      const receiverLat = location.coords.latitude;
      const receiverLng = location.coords.longitude;

      // Update session with receiver location
      const { error: updateError } = await supabase
        .from('meet_sessions')
        .update({
          receiver_lat: receiverLat,
          receiver_lng: receiverLng,
          status: 'receiver_joined',
        })
        .eq('id', id);

      if (updateError) {
        console.error('[Session] Error updating receiver location:', updateError);
        Alert.alert('Error', 'Failed to update your location');
        setUpdatingLocation(false);
        return;
      }

      console.log('[Session] Receiver location updated successfully');

      // Calculate midpoint and search places
      const updatedSession = {
        ...sessionData,
        receiver_lat: receiverLat,
        receiver_lng: receiverLng,
        status: 'receiver_joined' as const,
      };

      setSession(updatedSession);
      await calculateAndSearchPlaces(id, updatedSession);
      setUpdatingLocation(false);
    } catch (err) {
      console.error('[Session] Error capturing receiver location:', err);
      Alert.alert('Error', 'Failed to get your location');
      setUpdatingLocation(false);
    }
  };

  const calculateAndSearchPlaces = async (id: string, sessionData: MeetSession) => {
    try {
      if (!sessionData.receiver_lat || !sessionData.receiver_lng) {
        console.log('[Session] Cannot calculate midpoint, receiver location missing');
        return;
      }

      console.log('[Session] Calculating midpoint and searching places...');

      // Calculate midpoint
      const { midLat, midLng } = calculateMidpoint(
        sessionData.sender_lat,
        sessionData.sender_lng,
        sessionData.receiver_lat,
        sessionData.receiver_lng,
        false // SafeMeet not applicable here
      );

      console.log('[Session] Midpoint calculated:', { midLat, midLng });

      // Reverse geocode midpoint
      await reverseGeocodeMidpoint(midLat, midLng);

      // Search for nearby places with radius expansion if needed
      let foundPlaces: Place[] = [];
      let currentRadius = sessionData.radius_meters;
      const maxRadius = currentRadius * 2; // Expand once if needed

      try {
        foundPlaces = await searchNearbyPlaces(midLat, midLng, sessionData.type);
        console.log('[Session] Found places with initial radius:', foundPlaces.length);

        // If fewer than 1 result, expand radius once
        if (foundPlaces.length < 1 && currentRadius < maxRadius) {
          console.log('[Session] Expanding search radius...');
          currentRadius = maxRadius;
          foundPlaces = await searchNearbyPlaces(midLat, midLng, sessionData.type);
          console.log('[Session] Found places with expanded radius:', foundPlaces.length);
        }
      } catch (searchError) {
        console.error('[Session] Error searching places:', searchError);
        // Continue with empty results rather than failing
      }

      // Ensure at least 1 result, max 3 results, and unique
      const uniquePlaces = foundPlaces.filter((place, index, self) =>
        index === self.findIndex((p) => p.placeId === place.placeId)
      );

      const finalPlaces = uniquePlaces.slice(0, 3);

      if (finalPlaces.length === 0) {
        console.warn('[Session] No places found even after expanding radius');
        Alert.alert('No Places Found', 'Could not find any meeting spots near the midpoint. Try a different category.');
      }

      console.log('[Session] Final places to save:', finalPlaces.length);
      setPlaces(finalPlaces);

      // Update session with results
      const { error: updateError } = await supabase
        .from('meet_sessions')
        .update({
          results_json: finalPlaces,
          radius_meters: currentRadius,
        })
        .eq('id', id);

      if (updateError) {
        console.error('[Session] Error updating session with results:', updateError);
      } else {
        console.log('[Session] Session updated with results');
      }
    } catch (err) {
      console.error('[Session] Error in calculateAndSearchPlaces:', err);
      Alert.alert('Error', 'Failed to calculate midpoint and search places');
    }
  };

  const reverseGeocodeMidpoint = async (latitude: number, longitude: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      
      if (results && results.length > 0) {
        const address = results[0];
        const parts = [
          address?.streetNumber,
          address?.street,
          address?.city,
          address?.region,
          address?.postalCode,
        ].filter(Boolean);
        
        const formattedAddress = parts.join(', ');
        console.log('[Session] Midpoint address:', formattedAddress);
        setMidpointAddress(formattedAddress || null);
      }
    } catch (err) {
      console.error('[Session] Error reverse geocoding:', err);
    }
  };

  const handleSelectPlace = async (place: Place) => {
    if (!session) return;

    console.log('[Session] Selecting place:', place.name);

    try {
      const { error: updateError } = await supabase
        .from('meet_sessions')
        .update({
          selected_place_id: place.id,
          status: 'selected',
        })
        .eq('id', session.id);

      if (updateError) {
        console.error('[Session] Error updating selected place:', updateError);
        Alert.alert('Error', 'Failed to update selected place');
        return;
      }

      // Update local state
      setSession({
        ...session,
        selected_place_id: place.id,
        status: 'selected',
      });

      console.log('[Session] Selected place updated successfully');
    } catch (err) {
      console.error('[Session] Error selecting place:', err);
      Alert.alert('Error', 'Failed to update selected place');
    }
  };

  const handleGetDirections = (place: Place) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
    console.log('[Session] Opening directions to:', place.name);

    Linking.openURL(url).catch((err) => {
      console.error('[Session] Error opening maps:', err);
      Alert.alert('Error', 'Failed to open maps');
    });
  };

  const renderPlaceItem = ({ item, index }: { item: Place; index: number }) => {
    const isSelected = session?.selected_place_id === item.id;

    return (
      <TouchableOpacity
        key={item?.id || `place-${index}`}
        style={[
          styles.placeCard,
          { 
            backgroundColor: colors.card, 
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 3 : 1,
          }
        ]}
        onPress={() => handleSelectPlace(item)}
        activeOpacity={0.7}
      >
        {isSelected && (
          <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
            <Text style={styles.selectedBadgeText}>Selected</Text>
          </View>
        )}
        <View style={styles.placeHeader}>
          <View style={[styles.placeRank, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.placeRankText, { color: colors.primary }]}>#{index + 1}</Text>
          </View>
          <View style={styles.placeInfo}>
            <Text style={[styles.placeName, { color: colors.text }]} numberOfLines={1}>
              {item?.name || 'Unknown Place'}
            </Text>
            <Text style={[styles.placeAddress, { color: colors.textSecondary }]} numberOfLines={2}>
              {item?.address || 'Address not available'}
            </Text>
            <View style={styles.placeMetrics}>
              {item?.rating > 0 && (
                <View style={styles.ratingContainer}>
                  <MaterialIcons name="star" size={16} color="#FFC107" />
                  <Text style={[styles.ratingText, { color: colors.text }]}>
                    {item.rating.toFixed(1)}
                  </Text>
                </View>
              )}
              <View style={styles.distanceContainer}>
                <MaterialIcons name="place" size={16} color={colors.textSecondary} />
                <Text style={[styles.distanceText, { color: colors.textSecondary }]}>
                  {item?.distance?.toFixed(1) || '0.0'} km
                </Text>
              </View>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.directionsButton, { backgroundColor: colors.primary }]}
          onPress={() => handleGetDirections(item)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="directions" size={20} color="#FFFFFF" />
          <Text style={styles.directionsButtonText}>Get Directions</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          {updatingLocation ? 'Updating your location...' : 'Loading session...'}
        </Text>
      </View>
    );
  }

  // Error state
  if (error || !session) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <MaterialIcons name="error-outline" size={64} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          {error || 'This session link is invalid or expired.'}
        </Text>
        <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
          The session you&apos;re trying to access could not be found or has expired.
        </Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.backButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Waiting for receiver state
  if (session.status === 'pending' && !isReceiver) {
    return (
      <View style={[styles.waitingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.waitingTitle, { color: colors.text }]}>
          Waiting for the other person to join...
        </Text>
        <Text style={[styles.waitingSubtitle, { color: colors.textSecondary }]}>
          This will update automatically when they open the link
        </Text>
      </View>
    );
  }

  // Calculate midpoint for display
  const midLat = session.receiver_lat 
    ? (session.sender_lat + session.receiver_lat) / 2 
    : session.sender_lat;
  const midLng = session.receiver_lng 
    ? (session.sender_lng + session.receiver_lng) / 2 
    : session.sender_lng;

  // Main session view
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      {session.status === 'selected' && (
        <View style={[styles.successBanner, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
          <MaterialIcons name="check-circle" size={32} color={colors.success} />
          <Text style={[styles.successText, { color: colors.success }]}>
            Meeting place selected!
          </Text>
        </View>
      )}

      {session.status === 'receiver_joined' && places.length === 0 && (
        <View style={[styles.waitingBanner, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.waitingBannerText, { color: colors.primary }]}>
            Calculating midpoint and searching for places...
          </Text>
        </View>
      )}

      <Text style={[styles.title, { color: colors.text }]}>Meet Session</Text>

      {/* Midpoint Info */}
      {session.receiver_lat && session.receiver_lng && (
        <View style={[styles.midpointCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.midpointHeader}>
            <MaterialIcons name="place" size={32} color={colors.primary} />
            <Text style={[styles.midpointTitle, { color: colors.text }]}>Midpoint Location</Text>
          </View>

          {midpointAddress && (
            <Text style={[styles.midpointAddress, { color: colors.text }]} numberOfLines={2}>
              {midpointAddress}
            </Text>
          )}

          <Text style={[styles.midpointCoords, { color: colors.textSecondary }]}>
            {midLat.toFixed(4)}, {midLng.toFixed(4)}
          </Text>
        </View>
      )}

      {/* Map Placeholder */}
      <View style={[styles.mapPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MaterialIcons name="map" size={48} color={colors.textSecondary} />
        <Text style={[styles.mapPlaceholderText, { color: colors.textSecondary }]}>
          Map view with markers for both users and the midpoint
        </Text>
        <Text style={[styles.mapPlaceholderSubtext, { color: colors.textSecondary }]}>
          (react-native-maps not supported in Natively)
        </Text>
      </View>

      {/* Suggested Places */}
      <View style={styles.placesSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Suggested Places ({places.length})
        </Text>

        {places.length > 0 ? (
          <FlatList
            data={places}
            renderItem={renderPlaceItem}
            keyExtractor={(item, index) => item?.id || `place-${index}`}
            scrollEnabled={false}
            contentContainerStyle={styles.placesList}
          />
        ) : (
          <View style={[styles.noPlacesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialIcons name="info-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.noPlacesText, { color: colors.textSecondary }]}>
              {session.status === 'receiver_joined' 
                ? 'Searching for places near the midpoint...'
                : 'No places found near the midpoint'}
            </Text>
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
  scrollContent: {
    padding: 24,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  waitingTitle: {
    marginTop: 24,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  waitingSubtitle: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 24,
  },
  successText: {
    fontSize: 18,
    fontWeight: '700',
  },
  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
  },
  waitingBannerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  midpointCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  midpointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  midpointTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  midpointAddress: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 22,
  },
  midpointCoords: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  mapPlaceholder: {
    padding: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    minHeight: 200,
  },
  mapPlaceholderText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  mapPlaceholderSubtext: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
  placesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  placesList: {
    gap: 12,
  },
  placeCard: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  placeHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  placeRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeRankText: {
    fontSize: 14,
    fontWeight: '700',
  },
  placeInfo: {
    flex: 1,
    gap: 4,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '700',
  },
  placeAddress: {
    fontSize: 14,
    lineHeight: 18,
  },
  placeMetrics: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 14,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  directionsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  noPlacesCard: {
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  noPlacesText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
});

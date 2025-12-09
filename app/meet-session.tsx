
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from '@/app/integrations/supabase/client';
import * as Location from 'expo-location';
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

interface MeetPoint {
  id: string;
  meet_point_id: string;
  sender_name: string;
  sender_lat: number;
  sender_lng: number;
  receiver_name: string | null;
  receiver_lat: number | null;
  receiver_lng: number | null;
  type: string;
  safe: boolean;
  status: 'link_sent' | 'joined' | 'ready';
  midpoint_lat: number | null;
  midpoint_lng: number | null;
  hotspot_results: Place[] | null;
  selected_place_id: string | null;
  selected_place_name: string | null;
  selected_place_lat: number | null;
  selected_place_lng: number | null;
  selected_place_address: string | null;
  created_at: string;
  updated_at: string;
}

export default function MeetSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Extract meetPointId from URL parameters
  const meetPointId = params?.meetPointId as string;

  const [meetPoint, setMeetPoint] = useState<MeetPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [midpointAddress, setMidpointAddress] = useState<string | null>(null);

  console.log('[MeetSession] Screen mounted');
  console.log('[MeetSession] URL params:', JSON.stringify(params, null, 2));
  console.log('[MeetSession] meetPointId from params:', meetPointId);

  useEffect(() => {
    if (!meetPointId) {
      console.error('[MeetSession] ERROR: No meetPointId provided in URL params');
      setError('invalid');
      setLoading(false);
      return;
    }

    console.log('[MeetSession] Valid meetPointId detected, loading MeetPoint...');
    loadMeetPoint();
    subscribeToMeetPoint();

    return () => {
      if (channelRef.current) {
        console.log('[MeetSession] Cleaning up Supabase subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [meetPointId]);

  const loadMeetPoint = async () => {
    try {
      console.log('[MeetSession] Fetching MeetPoint from Supabase with ID:', meetPointId);
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('meet_points')
        .select('*')
        .eq('meet_point_id', meetPointId)
        .single();

      if (fetchError) {
        console.error('[MeetSession] Supabase fetch error:', fetchError);
        setError('notfound');
        setLoading(false);
        return;
      }

      if (!data) {
        console.error('[MeetSession] No MeetPoint found with ID:', meetPointId);
        setError('notfound');
        setLoading(false);
        return;
      }

      console.log('[MeetSession] MeetPoint loaded successfully:', {
        id: data.meet_point_id,
        status: data.status,
        senderName: data.sender_name,
        receiverName: data.receiver_name,
        hasMidpoint: !!(data.midpoint_lat && data.midpoint_lng),
        hotspotCount: data.hotspot_results?.length || 0,
      });

      setMeetPoint(data as MeetPoint);

      // Reverse geocode midpoint if available
      if (data.midpoint_lat && data.midpoint_lng) {
        console.log('[MeetSession] Reverse geocoding midpoint:', {
          lat: data.midpoint_lat,
          lng: data.midpoint_lng,
        });
        reverseGeocodeMidpoint(data.midpoint_lat, data.midpoint_lng);
      }

      setLoading(false);
    } catch (err: any) {
      console.error('[MeetSession] Error loading MeetPoint:', err);
      setError('error');
      setLoading(false);
    }
  };

  const subscribeToMeetPoint = () => {
    if (channelRef.current?.state === 'subscribed') {
      console.log('[MeetSession] Already subscribed to MeetPoint updates');
      return;
    }

    console.log('[MeetSession] Subscribing to real-time updates for:', meetPointId);

    const channel = supabase
      .channel(`meetpoint:${meetPointId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meet_points',
          filter: `meet_point_id=eq.${meetPointId}`,
        },
        (payload) => {
          console.log('[MeetSession] Real-time update received:', payload);
          if (payload.new) {
            const updatedMeetPoint = payload.new as MeetPoint;
            setMeetPoint(updatedMeetPoint);

            // Reverse geocode midpoint if available
            if (updatedMeetPoint.midpoint_lat && updatedMeetPoint.midpoint_lng) {
              reverseGeocodeMidpoint(
                updatedMeetPoint.midpoint_lat,
                updatedMeetPoint.midpoint_lng
              );
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[MeetSession] Subscription status:', status);
      });

    channelRef.current = channel;
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
        console.log('[MeetSession] Midpoint address:', formattedAddress);
        setMidpointAddress(formattedAddress || null);
      }
    } catch (err) {
      console.error('[MeetSession] Error reverse geocoding:', err);
    }
  };

  const handleSelectPlace = async (place: Place) => {
    if (!meetPoint) return;

    console.log('[MeetSession] Selecting place:', place.name);

    try {
      const { error: updateError } = await supabase
        .from('meet_points')
        .update({
          selected_place_id: place.id,
          selected_place_name: place.name,
          selected_place_lat: place.latitude,
          selected_place_lng: place.longitude,
          selected_place_address: place.address,
        })
        .eq('meet_point_id', meetPointId);

      if (updateError) {
        console.error('[MeetSession] Error updating selected place:', updateError);
        Alert.alert('Error', 'Failed to update selected place. Please try again.');
        return;
      }

      console.log('[MeetSession] Selected place updated successfully');
    } catch (err) {
      console.error('[MeetSession] Error selecting place:', err);
      Alert.alert('Error', 'Failed to update selected place. Please try again.');
    }
  };

  const handleGetDirections = (lat: number, lng: number, name?: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    console.log('[MeetSession] Opening directions to:', name || 'location');
    Linking.openURL(url).catch((err) => {
      console.error('[MeetSession] Error opening maps:', err);
      Alert.alert('Error', 'Failed to open maps. Please try again.');
    });
  };

  const places = useMemo(() => {
    return (meetPoint?.hotspot_results || []) as Place[];
  }, [meetPoint?.hotspot_results]);

  console.log('[MeetSession] Render state:', {
    loading,
    error,
    hasMeetPoint: !!meetPoint,
    status: meetPoint?.status,
    placesCount: places.length,
  });

  // Loading state
  if (loading) {
    console.log('[MeetSession] Rendering loading state');
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.statusText, { color: colors.text }]}>
          Loading Meet Point...
        </Text>
      </View>
    );
  }

  // Error states
  if (error === 'invalid') {
    console.log('[MeetSession] Rendering invalid error state');
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <MaterialIcons name="link-off" size={80} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Invalid Link</Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          This Meet Point link is missing required information.
        </Text>
        <TouchableOpacity
          style={[styles.errorButton, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/')}
          activeOpacity={0.8}
        >
          <Text style={styles.errorButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error === 'notfound') {
    console.log('[MeetSession] Rendering not found error state');
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <MaterialIcons name="location-off" size={80} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          Meet Point Not Found
        </Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          This Meet Point could not be found. It may have expired or been deleted.
        </Text>
        <TouchableOpacity
          style={[styles.errorButton, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/')}
          activeOpacity={0.8}
        >
          <Text style={styles.errorButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error === 'error') {
    console.log('[MeetSession] Rendering generic error state');
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <MaterialIcons name="error-outline" size={80} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          Something Went Wrong
        </Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          An unexpected error occurred. Please try again.
        </Text>
        <TouchableOpacity
          style={[styles.errorButton, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/')}
          activeOpacity={0.8}
        >
          <Text style={styles.errorButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!meetPoint) {
    console.log('[MeetSession] No meetPoint data available');
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.text }]}>No Data</Text>
      </View>
    );
  }

  // Waiting for other user to join
  if (meetPoint.status === 'link_sent') {
    console.log('[MeetSession] Rendering waiting state');
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.statusText, { color: colors.text }]}>
          Waiting for {meetPoint.receiver_name || 'the other person'} to join...
        </Text>
        <Text style={[styles.statusSubtext, { color: colors.textSecondary }]}>
          This will update automatically when they open the link
        </Text>
      </View>
    );
  }

  // Main session view with map and hotspots
  console.log('[MeetSession] Rendering main session view');
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'android' && { paddingTop: 48 },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: colors.card }]}
          >
            <MaterialIcons name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.sessionTitle, { color: colors.text }]}>
              Meet Session
            </Text>
            <Text style={[styles.sessionSubtitle, { color: colors.textSecondary }]}>
              {meetPoint.sender_name} & {meetPoint.receiver_name || 'Unknown'}
            </Text>
          </View>
        </View>

        {/* Safe Mode Indicator */}
        {meetPoint.safe && (
          <View
            style={[
              styles.safeModeIndicator,
              { backgroundColor: colors.success + '20', borderColor: colors.success },
            ]}
          >
            <Text style={[styles.safeModeText, { color: colors.success }]}>
              🔒 Safe Meet Mode Active
            </Text>
          </View>
        )}

        {/* Map Card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Map View</Text>

          {/* Map Placeholder */}
          <View style={[styles.mapPlaceholder, { backgroundColor: colors.background }]}>
            <MaterialIcons name="map" size={64} color={colors.primary} />
            <Text style={[styles.mapNotice, { color: colors.textSecondary }]}>
              Note: react-native-maps is not supported in Natively
            </Text>

            {/* Midpoint Info */}
            {meetPoint.midpoint_lat && meetPoint.midpoint_lng && (
              <View style={styles.mapInfo}>
                <View style={styles.mapInfoRow}>
                  <MaterialIcons name="place" size={20} color={colors.primary} />
                  <Text style={[styles.mapInfoLabel, { color: colors.text }]}>
                    Midpoint
                  </Text>
                </View>
                {midpointAddress && (
                  <Text style={[styles.mapInfoAddress, { color: colors.text }]}>
                    {midpointAddress}
                  </Text>
                )}
                <Text style={[styles.mapInfoCoords, { color: colors.textSecondary }]}>
                  {meetPoint.midpoint_lat.toFixed(4)}, {meetPoint.midpoint_lng.toFixed(4)}
                </Text>
              </View>
            )}

            {/* User Markers Info */}
            <View style={styles.markersInfo}>
              <View style={styles.markerItem}>
                <View style={[styles.markerDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.markerLabel, { color: colors.text }]}>
                  {meetPoint.sender_name}
                </Text>
                <Text style={[styles.markerCoords, { color: colors.textSecondary }]}>
                  {meetPoint.sender_lat.toFixed(4)}, {meetPoint.sender_lng.toFixed(4)}
                </Text>
              </View>
              {meetPoint.receiver_lat && meetPoint.receiver_lng && (
                <View style={styles.markerItem}>
                  <View style={[styles.markerDot, { backgroundColor: colors.secondary }]} />
                  <Text style={[styles.markerLabel, { color: colors.text }]}>
                    {meetPoint.receiver_name || 'Unknown'}
                  </Text>
                  <Text style={[styles.markerCoords, { color: colors.textSecondary }]}>
                    {meetPoint.receiver_lat.toFixed(4)}, {meetPoint.receiver_lng.toFixed(4)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Open in Maps Button */}
          {meetPoint.midpoint_lat && meetPoint.midpoint_lng && (
            <TouchableOpacity
              style={[styles.openMapsButton, { backgroundColor: colors.accent }]}
              onPress={() =>
                handleGetDirections(
                  meetPoint.midpoint_lat!,
                  meetPoint.midpoint_lng!,
                  'Midpoint'
                )
              }
              activeOpacity={0.8}
            >
              <MaterialIcons name="map" size={20} color="#FFFFFF" />
              <Text style={styles.openMapsButtonText}>Open Midpoint in Maps</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Selected Place Card */}
        {meetPoint.selected_place_name && (
          <View
            style={[
              styles.selectedPlaceCard,
              { backgroundColor: colors.primary + '15', borderColor: colors.primary },
            ]}
          >
            <View style={styles.selectedPlaceHeader}>
              <MaterialIcons name="location-on" size={32} color={colors.primary} />
              <View style={styles.selectedPlaceInfo}>
                <Text style={[styles.selectedPlaceLabel, { color: colors.textSecondary }]}>
                  Selected Meet Point
                </Text>
                <Text style={[styles.selectedPlaceName, { color: colors.text }]}>
                  {meetPoint.selected_place_name}
                </Text>
                {meetPoint.selected_place_address && (
                  <Text
                    style={[styles.selectedPlaceAddress, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {meetPoint.selected_place_address}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.directionsButton, { backgroundColor: colors.primary }]}
              onPress={() =>
                handleGetDirections(
                  meetPoint.selected_place_lat!,
                  meetPoint.selected_place_lng!,
                  meetPoint.selected_place_name!
                )
              }
              activeOpacity={0.8}
            >
              <MaterialIcons name="directions" size={24} color="#FFFFFF" />
              <Text style={styles.directionsButtonText}>Get Directions</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hotspots Card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Suggested Meet Spots ({places.length})
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            Public locations near the midpoint
          </Text>

          {places.length > 0 ? (
            <View style={styles.placesList}>
              {places.map((place, index) => {
                const isSelected = meetPoint.selected_place_id === place.id;

                return (
                  <View
                    key={place.id || `place-${index}`}
                    style={[
                      styles.placeCard,
                      {
                        backgroundColor: colors.background,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    {isSelected && (
                      <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                        <MaterialIcons name="check-circle" size={16} color="#FFFFFF" />
                        <Text style={styles.selectedBadgeText}>Selected</Text>
                      </View>
                    )}
                    <View style={styles.placeHeader}>
                      <View style={styles.placeRank}>
                        <Text style={[styles.placeRankText, { color: colors.primary }]}>
                          #{index + 1}
                        </Text>
                      </View>
                      <View style={styles.placeInfo}>
                        <Text style={[styles.placeName, { color: colors.text }]} numberOfLines={1}>
                          {place.name}
                        </Text>
                        <Text
                          style={[styles.placeAddress, { color: colors.textSecondary }]}
                          numberOfLines={2}
                        >
                          {place.address}
                        </Text>
                        <View style={styles.placeMetrics}>
                          {place.rating > 0 && (
                            <View style={styles.ratingContainer}>
                              <MaterialIcons name="star" size={14} color="#FFC107" />
                              <Text style={[styles.ratingText, { color: colors.text }]}>
                                {place.rating.toFixed(1)}
                              </Text>
                            </View>
                          )}
                          <View style={styles.distanceContainer}>
                            <MaterialIcons name="place" size={14} color={colors.textSecondary} />
                            <Text style={[styles.distanceText, { color: colors.textSecondary }]}>
                              {place.distance.toFixed(1)} km
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    <View style={styles.placeActions}>
                      {!isSelected && (
                        <TouchableOpacity
                          style={[
                            styles.selectButton,
                            { backgroundColor: colors.secondary, borderColor: colors.border },
                          ]}
                          onPress={() => handleSelectPlace(place)}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons name="check" size={18} color="#FFFFFF" />
                          <Text style={styles.selectButtonText}>Select</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[
                          styles.navigateButton,
                          { backgroundColor: colors.accent, borderColor: colors.border },
                        ]}
                        onPress={() => handleGetDirections(place.latitude, place.longitude, place.name)}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons name="navigation" size={18} color="#FFFFFF" />
                        <Text style={styles.navigateButtonText}>Navigate</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={[styles.noPlacesCard, { backgroundColor: colors.background }]}>
              <MaterialIcons name="info-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.noPlacesText, { color: colors.textSecondary }]}>
                No places found near the midpoint
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  statusText: {
    marginTop: 24,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusSubtext: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  errorButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sessionSubtitle: {
    fontSize: 16,
  },
  safeModeIndicator: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
    alignItems: 'center',
  },
  safeModeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  cardSubtitle: {
    fontSize: 14,
    marginBottom: 12,
    marginTop: -8,
  },
  mapPlaceholder: {
    minHeight: 300,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginBottom: 12,
  },
  mapNotice: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  mapInfo: {
    width: '100%',
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(63, 81, 181, 0.1)',
    marginBottom: 16,
  },
  mapInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  mapInfoLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  mapInfoAddress: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  mapInfoCoords: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  markersInfo: {
    width: '100%',
    gap: 12,
  },
  markerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  markerLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  markerCoords: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  openMapsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedPlaceCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 3,
    marginBottom: 16,
    gap: 16,
  },
  selectedPlaceHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  selectedPlaceInfo: {
    flex: 1,
    gap: 4,
  },
  selectedPlaceLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedPlaceName: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  selectedPlaceAddress: {
    fontSize: 14,
    lineHeight: 18,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 10,
  },
  directionsButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
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
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
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
    backgroundColor: 'rgba(63, 81, 181, 0.1)',
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
  placeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  selectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  navigateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  navigateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  noPlacesCard: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  noPlacesText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
});

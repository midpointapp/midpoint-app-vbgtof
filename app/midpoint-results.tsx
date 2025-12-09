
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from '@/app/integrations/supabase/client';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';

const USER_STORAGE_KEY = '@midpoint_user';

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

export default function MidpointResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const meetPointId = params?.meetPointId as string;

  const [meetPoint, setMeetPoint] = useState<MeetPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [midpointAddress, setMidpointAddress] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentUserName();
  }, []);

  useEffect(() => {
    if (!meetPointId) {
      Alert.alert('Error', 'No Meet Point ID provided', [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
      return;
    }

    loadMeetPoint();
    subscribeToMeetPoint();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [meetPointId]);

  const loadCurrentUserName = async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const userData = JSON.parse(stored);
        setCurrentUserName(userData?.name || null);
      }
    } catch (error) {
      console.error('Error loading current user name:', error);
    }
  };

  const loadMeetPoint = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('meet_points')
        .select('*')
        .eq('meet_point_id', meetPointId)
        .single();

      if (error || !data) {
        console.error('Error loading MeetPoint:', error);
        Alert.alert('Error', 'Failed to load Meet Point data', [
          { text: 'OK', onPress: () => router.replace('/') },
        ]);
        return;
      }

      console.log('Loaded MeetPoint:', data);
      setMeetPoint(data as MeetPoint);

      // Reverse geocode midpoint if available
      if (data.midpoint_lat && data.midpoint_lng) {
        reverseGeocodeMidpoint(data.midpoint_lat, data.midpoint_lng);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading MeetPoint:', error);
      setLoading(false);
    }
  };

  const subscribeToMeetPoint = () => {
    // Check if already subscribed
    if (channelRef.current?.state === 'subscribed') {
      console.log('Already subscribed to MeetPoint channel');
      return;
    }

    console.log('Subscribing to MeetPoint updates:', meetPointId);

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
          console.log('MeetPoint updated:', payload);
          if (payload.new) {
            setMeetPoint(payload.new as MeetPoint);

            // Reverse geocode midpoint if available
            const newData = payload.new as MeetPoint;
            if (newData.midpoint_lat && newData.midpoint_lng) {
              reverseGeocodeMidpoint(newData.midpoint_lat, newData.midpoint_lng);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
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
        console.log('Midpoint address:', formattedAddress);
        setMidpointAddress(formattedAddress || null);
      }
    } catch (error) {
      console.error('Error reverse geocoding midpoint:', error);
    }
  };

  const handleSelectPlace = async (place: Place) => {
    if (!meetPoint) {
      return;
    }

    console.log('Selecting place as meet location:', place.name);

    try {
      // Update the selected place in Supabase
      const { error } = await supabase
        .from('meet_points')
        .update({
          selected_place_id: place.id,
          selected_place_name: place.name,
          selected_place_lat: place.latitude,
          selected_place_lng: place.longitude,
          selected_place_address: place.address,
        })
        .eq('meet_point_id', meetPointId);

      if (error) {
        console.error('Error updating selected place:', error);
        Alert.alert('Error', 'Failed to update selected place. Please try again.');
        return;
      }

      console.log('Selected place updated successfully');
    } catch (error) {
      console.error('Error selecting place:', error);
      Alert.alert('Error', 'Failed to update selected place. Please try again.');
    }
  };

  const handleGetDirections = () => {
    if (!meetPoint?.selected_place_lat || !meetPoint?.selected_place_lng) {
      Alert.alert('Error', 'No meeting location selected');
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${meetPoint.selected_place_lat},${meetPoint.selected_place_lng}&query_place_id=${meetPoint.selected_place_id || ''}`;

    console.log('Opening directions to selected place:', meetPoint.selected_place_name);

    Linking.openURL(url).catch((err) => {
      console.error('Error opening maps:', err);
      Alert.alert('Error', 'Failed to open maps. Please try again.');
    });
  };

  const handleOpenMidpointInMaps = () => {
    if (!meetPoint?.midpoint_lat || !meetPoint?.midpoint_lng) {
      Alert.alert('Error', 'Midpoint location not available');
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${meetPoint.midpoint_lat},${meetPoint.midpoint_lng}`;

    console.log('Opening midpoint in maps');

    Linking.openURL(url).catch((err) => {
      console.error('Error opening maps:', err);
      Alert.alert('Error', 'Failed to open maps. Please try again.');
    });
  };

  const renderPlaceItem = ({ item, index }: { item: Place; index: number }) => {
    const isSelected = meetPoint?.selected_place_id === item.id;

    return (
      <View
        key={item?.id || `place-${index}`}
        style={[
          styles.placeCard,
          { 
            backgroundColor: colors.card, 
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 3 : 1,
          }
        ]}
      >
        {isSelected && (
          <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
            <Text style={styles.selectedBadgeText}>Selected Meet Point</Text>
          </View>
        )}
        <View style={styles.placeHeader}>
          <View style={styles.placeRank}>
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
        <View style={styles.placeActions}>
          {!isSelected && (
            <TouchableOpacity
              style={[styles.selectButton, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => handleSelectPlace(item)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="check" size={20} color="#FFFFFF" />
              <Text style={styles.selectButtonText}>Set as Meet Point</Text>
            </TouchableOpacity>
          )}
          {isSelected && (
            <TouchableOpacity
              style={[styles.directionsButton, { backgroundColor: colors.primary }]}
              onPress={handleGetDirections}
              activeOpacity={0.8}
            >
              <MaterialIcons name="directions" size={20} color="#FFFFFF" />
              <Text style={styles.directionsButtonText}>Get Directions</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Determine who the "other person" is
  const getOtherPersonName = (): string => {
    if (!meetPoint) return 'Unknown';
    
    // If current user is the sender, show receiver name
    if (currentUserName === meetPoint.sender_name) {
      return meetPoint.receiver_name || 'Unknown';
    }
    
    // If current user is the receiver, show sender name
    return meetPoint.sender_name || 'Unknown';
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading Meet Point...</Text>
      </View>
    );
  }

  if (!meetPoint) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <MaterialIcons name="error-outline" size={64} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.text }]}>Meet Point not found</Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.backButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show waiting state if not ready
  if (meetPoint.status !== 'ready') {
    return (
      <View style={[styles.waitingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.waitingTitle, { color: colors.text }]}>
          {meetPoint.status === 'link_sent'
            ? 'Waiting for them to open your Meet Point...'
            : 'Calculating midpoint...'}
        </Text>
        <Text style={[styles.waitingSubtitle, { color: colors.textSecondary }]}>
          This will update automatically when ready
        </Text>
      </View>
    );
  }

  const places = (meetPoint.hotspot_results || []) as Place[];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={[styles.successBanner, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
        <MaterialIcons name="check-circle" size={32} color={colors.success} />
        <Text style={[styles.successText, { color: colors.success }]}>
          Your Meet Point is ready!
        </Text>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>Meet Point Results</Text>

      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Meeting with</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>{getOtherPersonName()}</Text>
      </View>

      {meetPoint.selected_place_name && (
        <View style={[styles.selectedPlaceCard, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
          <View style={styles.selectedPlaceHeader}>
            <MaterialIcons name="location-on" size={32} color={colors.primary} />
            <View style={styles.selectedPlaceInfo}>
              <Text style={[styles.selectedPlaceLabel, { color: colors.textSecondary }]}>
                Current Meet Point
              </Text>
              <Text style={[styles.selectedPlaceName, { color: colors.text }]} numberOfLines={2}>
                {meetPoint.selected_place_name}
              </Text>
              {meetPoint.selected_place_address && (
                <Text style={[styles.selectedPlaceAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                  {meetPoint.selected_place_address}
                </Text>
              )}
              {meetPoint.selected_place_lat && meetPoint.selected_place_lng && (
                <Text style={[styles.selectedPlaceCoords, { color: colors.textSecondary }]}>
                  {meetPoint.selected_place_lat.toFixed(4)}, {meetPoint.selected_place_lng.toFixed(4)}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.mainDirectionsButton, { backgroundColor: colors.primary }]}
            onPress={handleGetDirections}
            activeOpacity={0.8}
          >
            <MaterialIcons name="directions" size={24} color="#FFFFFF" />
            <Text style={styles.mainDirectionsButtonText}>Get Directions</Text>
          </TouchableOpacity>
        </View>
      )}

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
          {meetPoint.midpoint_lat?.toFixed(4)}, {meetPoint.midpoint_lng?.toFixed(4)}
        </Text>

        <TouchableOpacity
          style={[styles.viewMapButton, { backgroundColor: colors.secondary }]}
          onPress={handleOpenMidpointInMaps}
          activeOpacity={0.8}
        >
          <MaterialIcons name="map" size={20} color="#FFFFFF" />
          <Text style={styles.viewMapButtonText}>View Midpoint on Map</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.placesSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Recommended Places ({places.length})
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Tap &quot;Set as Meet Point&quot; to change the meeting location
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
              No places found near the midpoint
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.doneButton, { borderColor: colors.border }]}
        onPress={() => router.replace('/')}
        activeOpacity={0.8}
      >
        <Text style={[styles.doneButtonText, { color: colors.text }]}>Done</Text>
      </TouchableOpacity>
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
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  selectedPlaceCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 3,
    marginBottom: 24,
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
  selectedPlaceCoords: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  mainDirectionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 10,
  },
  mainDirectionsButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
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
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  viewMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
  },
  viewMapButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  placesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
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
    gap: 8,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  doneButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

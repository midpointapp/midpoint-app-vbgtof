
import React, { useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import * as Location from 'expo-location';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { calculateMidpoint, searchNearbyPlaces, Place } from '@/utils/locationUtils';

interface LocationWithAddress {
  latitude: number;
  longitude: number;
  address?: string;
}

export default function InviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();

  // Parse URL parameters with safe fallbacks
  const inviterName = (params?.inviterName as string) || 'Someone';
  const inviterLat = params?.lat ? parseFloat(params.lat as string) : null;
  const inviterLng = params?.lng ? parseFloat(params.lng as string) : null;
  const meetupType = (params?.type as string) || 'public';
  const isSafeMode = params?.safe === 'true';

  const [myLocation, setMyLocation] = useState<LocationWithAddress | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [showResultModal, setShowResultModal] = useState(false);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [midpointCoords, setMidpointCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Validate parameters on mount
  useEffect(() => {
    if (inviterLat === null || inviterLng === null || isNaN(inviterLat) || isNaN(inviterLng)) {
      Alert.alert(
        'Invalid Invite Link',
        'This invite link is missing location information. Please ask the sender to create a new invite.',
        [{ text: 'Go Back', onPress: () => router.back() }]
      );
    }
  }, [inviterLat, inviterLng]);

  const reverseGeocode = async (latitude: number, longitude: number): Promise<string | null> => {
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
        console.log('Reverse geocoded address:', formattedAddress);
        return formattedAddress || null;
      }
      return null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      setLocationError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setLocationError('Location access denied. Enable in Settings.');
        Alert.alert(
          'Location Access Denied',
          'Location access denied. Please enable it in Settings to accept this invite.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Cancel' }
          ]
        );
        setLocationLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const address = await reverseGeocode(location.coords.latitude, location.coords.longitude);

      setMyLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: address || undefined,
      });

      console.log('Location obtained:', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address,
      });

      setLocationLoading(false);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Failed to get location. Check location services.');
      Alert.alert(
        'Location Error',
        'Unable to get your current location. Please make sure location services are enabled in Settings.',
        [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'Retry', onPress: getCurrentLocation },
          { text: 'Cancel' }
        ]
      );
      setLocationLoading(false);
    }
  };

  const handleShareLocationAndFindMidpoint = async () => {
    if (!myLocation) {
      Alert.alert(
        'Location Required',
        'Please share your location first to find the midpoint.',
        [
          { text: 'Share Location', onPress: getCurrentLocation },
          { text: 'Cancel' }
        ]
      );
      return;
    }

    if (inviterLat === null || inviterLng === null || isNaN(inviterLat) || isNaN(inviterLng)) {
      Alert.alert('Error', 'Invalid inviter location. Please ask for a new invite link.');
      return;
    }

    if (!meetupType) {
      Alert.alert('Error', 'Meetup type is missing. Please ask for a new invite link.');
      return;
    }

    try {
      setSearchingPlaces(true);
      setPlaces([]);

      // Calculate midpoint using existing logic
      const { midLat, midLng } = calculateMidpoint(
        myLocation.latitude,
        myLocation.longitude,
        inviterLat,
        inviterLng,
        false // Inviter already masked their location if safe mode was on
      );

      setMidpointCoords({ lat: midLat, lng: midLng });

      console.log('Searching for places near midpoint:', { midLat, midLng, meetupType });

      // Search for nearby places using Google Places API
      const foundPlaces = await searchNearbyPlaces(midLat, midLng, meetupType);

      console.log(`Found ${foundPlaces?.length || 0} places`);

      if (!foundPlaces || foundPlaces.length === 0) {
        Alert.alert(
          'No Places Found',
          'No places found near the midpoint. Try a different meetup type or contact the inviter.',
          [{ text: 'OK' }]
        );
        setSearchingPlaces(false);
        return;
      }

      setPlaces(foundPlaces);
      setShowResultModal(true);
      setSearchingPlaces(false);
    } catch (error: any) {
      console.error('Error finding midpoint:', error);
      setSearchingPlaces(false);

      let errorMessage = 'Failed to find places. Please try again.';

      if (error?.message) {
        if (error.message.includes('API key not configured')) {
          errorMessage = 'Google Places API key not configured. Please contact the app developer.';
        } else if (error.message.includes('API request denied')) {
          errorMessage = 'Google Places API access denied. Please contact the app developer.';
        } else if (error.message.includes('Network')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }

      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    }
  };

  const handleOpenInMaps = (place: Place) => {
    if (!place) {
      Alert.alert('Error', 'Invalid place data');
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}&query_place_id=${place.placeId || ''}`;

    console.log('Opening maps for place:', place.name);

    Linking.openURL(url).catch((err) => {
      console.error('Error opening maps:', err);
      Alert.alert('Error', 'Failed to open maps. Please try again.');
    });
  };

  const renderPlaceItem = ({ item, index }: { item: Place; index: number }) => (
    <View
      key={item?.id || `place-${index}`}
      style={[styles.placeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
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
      <TouchableOpacity
        style={[styles.mapsButton, { backgroundColor: colors.primary }]}
        onPress={() => handleOpenInMaps(item)}
        activeOpacity={0.8}
      >
        <MaterialIcons name="map" size={20} color="#FFFFFF" />
        <Text style={styles.mapsButtonText}>Open in Maps</Text>
      </TouchableOpacity>
    </View>
  );

  const getMeetupTypeLabel = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      gas: 'Gas stations',
      restaurant: 'Restaurants/Coffee shops',
      police: 'Police stations',
      rest: 'Rest areas',
      public: 'Other safe public places',
    };
    return typeMap[type] || type;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.inviteCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <View style={[styles.inviteIconContainer, { backgroundColor: colors.primary + '20' }]}>
            <MaterialIcons name="person-add" size={48} color={colors.primary} />
          </View>

          <Text style={[styles.inviteTitle, { color: colors.text }]}>
            You&apos;ve been invited!
          </Text>

          <Text style={[styles.inviteSubtitle, { color: colors.textSecondary }]}>
            {inviterName} wants to meet you halfway
          </Text>

          {meetupType && (
            <View style={[styles.meetupTypeBadge, { backgroundColor: colors.accent + '20' }]}>
              <MaterialIcons name="place" size={20} color={colors.accent} />
              <Text style={[styles.meetupTypeText, { color: colors.accent }]}>
                {getMeetupTypeLabel(meetupType)}
              </Text>
            </View>
          )}

          {isSafeMode && (
            <View style={[styles.safeBadge, { backgroundColor: colors.success + '20' }]}>
              <MaterialIcons name="lock" size={16} color={colors.success} />
              <Text style={[styles.safeText, { color: colors.success }]}>
                Safe Meet Mode
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.locationHeader}>
            <Text style={[styles.locationLabel, { color: colors.text }]}>Your Location</Text>
            {locationLoading && (
              <Text style={[styles.locationStatus, { color: colors.textSecondary }]}>Getting location...</Text>
            )}
            {locationError && (
              <TouchableOpacity onPress={getCurrentLocation}>
                <Text style={[styles.locationStatus, { color: colors.error }]}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
          {myLocation ? (
            <View style={styles.locationInfo}>
              <Text style={[styles.locationText, { color: colors.success }]}>
                ✓ Location obtained
              </Text>
              {myLocation.address && (
                <Text style={[styles.addressText, { color: colors.text }]} numberOfLines={2}>
                  {myLocation.address}
                </Text>
              )}
              <Text style={[styles.coordinatesText, { color: colors.textSecondary }]}>
                {myLocation.latitude.toFixed(4)}, {myLocation.longitude.toFixed(4)}
              </Text>
            </View>
          ) : locationError ? (
            <View>
              <Text style={[styles.locationText, { color: colors.error }]}>
                {locationError}
              </Text>
              <TouchableOpacity
                style={[styles.settingsButton, { backgroundColor: colors.primary }]}
                onPress={() => Linking.openSettings()}
              >
                <Text style={styles.settingsButtonText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[styles.locationText, { color: colors.textSecondary }]}>
              Tap the button below to share your location
            </Text>
          )}
        </View>

        {!myLocation && (
          <TouchableOpacity
            style={[
              styles.shareButton,
              { backgroundColor: colors.primary },
              locationLoading && styles.shareButtonDisabled
            ]}
            onPress={getCurrentLocation}
            activeOpacity={0.8}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.shareButtonText}>Getting location...</Text>
              </View>
            ) : (
              <>
                <MaterialIcons name="my-location" size={24} color="#FFFFFF" />
                <Text style={styles.shareButtonText}>Share My Location</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {myLocation && (
          <TouchableOpacity
            style={[
              styles.findButton,
              { backgroundColor: colors.secondary },
              searchingPlaces && styles.findButtonDisabled
            ]}
            onPress={handleShareLocationAndFindMidpoint}
            activeOpacity={0.8}
            disabled={searchingPlaces}
          >
            {searchingPlaces ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.findButtonText}>Searching...</Text>
              </View>
            ) : (
              <>
                <MaterialIcons name="explore" size={24} color="#FFFFFF" />
                <Text style={styles.findButtonText}>Find Midpoint & Places</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.backButton, { borderColor: colors.border }]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={[styles.backButtonText, { color: colors.text }]}>Go Back</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showResultModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowResultModal(false)}
      >
        <View style={styles.resultModalOverlay}>
          <TouchableOpacity
            style={styles.resultModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowResultModal(false)}
          />
          <View style={[styles.resultBottomSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.resultHandle, { backgroundColor: colors.border }]} />

            <View style={styles.resultContent}>
              <View style={[styles.resultIconContainer, { backgroundColor: colors.success + '20' }]}>
                <MaterialIcons name="check-circle" size={48} color={colors.success} />
              </View>

              <Text style={[styles.resultTitle, { color: colors.text }]}>
                {places?.length || 0} Place{places?.length !== 1 ? 's' : ''} Found!
              </Text>

              {inviterName && (
                <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>
                  Meeting with {inviterName}
                </Text>
              )}

              {midpointCoords && (
                <Text style={[styles.midpointCoords, { color: colors.textSecondary }]}>
                  Midpoint: {midpointCoords.lat.toFixed(4)}, {midpointCoords.lng.toFixed(4)}
                </Text>
              )}

              <FlatList
                data={places}
                renderItem={renderPlaceItem}
                keyExtractor={(item, index) => item?.id || `place-${index}`}
                style={styles.placesList}
                contentContainerStyle={styles.placesListContent}
                showsVerticalScrollIndicator={true}
              />

              <TouchableOpacity
                style={[styles.closeButton, { borderColor: colors.border }]}
                onPress={() => setShowResultModal(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.closeButtonText, { color: colors.text }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    padding: 24,
    paddingBottom: 120,
  },
  inviteCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 24,
    alignItems: 'center',
  },
  inviteIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  inviteTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  inviteSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  meetupTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  meetupTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  safeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  safeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  locationCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  locationInfo: {
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  coordinatesText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  settingsButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    marginBottom: 16,
    boxShadow: '0px 4px 12px rgba(63, 81, 181, 0.3)',
    elevation: 4,
  },
  shareButtonDisabled: {
    opacity: 0.5,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  findButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    marginBottom: 16,
    boxShadow: '0px 4px 12px rgba(233, 30, 99, 0.3)',
    elevation: 4,
  },
  findButtonDisabled: {
    opacity: 0.5,
  },
  findButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  resultModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  resultBottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '80%',
    boxShadow: '0px -4px 20px rgba(0, 0, 0, 0.15)',
    elevation: 10,
  },
  resultHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  resultContent: {
    paddingHorizontal: 24,
  },
  resultIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  resultSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  midpointCoords: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  placesList: {
    maxHeight: 400,
  },
  placesListContent: {
    paddingBottom: 16,
  },
  placeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 12,
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
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  mapsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    marginTop: 8,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

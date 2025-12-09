
import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  Platform, 
  Linking,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { calculateMidpoint, searchNearbyPlaces, Place, maskCoordinates } from '@/utils/locationUtils';
import { DOWNLOAD_LINK } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_STORAGE_KEY = '@midpoint_user';

const MEETUP_TYPES = [
  { id: 'gas', label: 'Gas stations', icon: 'local-gas-station' as const },
  { id: 'restaurant', label: 'Restaurants/Coffee shops', icon: 'restaurant' as const },
  { id: 'police', label: 'Police stations', icon: 'local-police' as const },
  { id: 'rest', label: 'Rest areas', icon: 'hotel' as const },
  { id: 'public', label: 'Other safe public places', icon: 'place' as const },
];

interface SavedContact {
  id: string;
  name: string;
  initials: string;
  phoneNumber?: string;
  lat?: number;
  lng?: number;
}

interface LocationWithAddress {
  latitude: number;
  longitude: number;
  address?: string;
}

export default function MeetNowScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const isSafeMode = params?.safeMode === 'true';

  const [currentUserName, setCurrentUserName] = useState('User');
  const [selectedContact, setSelectedContact] = useState<SavedContact | null>(null);
  const [selectedMeetupType, setSelectedMeetupType] = useState<string | null>(null);
  const [showMeetupTypeDropdown, setShowMeetupTypeDropdown] = useState(false);
  const [myLocation, setMyLocation] = useState<LocationWithAddress | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [showResultModal, setShowResultModal] = useState(false);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [midpointCoords, setMidpointCoords] = useState<{ lat: number; lng: number } | null>(null);

  const loadUserName = async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const userData = JSON.parse(stored);
        setCurrentUserName(userData?.name || 'User');
      }
    } catch (error) {
      console.error('Error loading user name:', error);
    }
  };

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

  const getCurrentLocation = useCallback(async () => {
    try {
      setLocationLoading(true);
      setLocationError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setLocationError('Location access denied. Enable in Settings.');
        Alert.alert(
          'Location Access Denied',
          'Location access denied. Please enable it in Settings to use MidPoint.',
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

      const address = isSafeMode ? null : await reverseGeocode(location.coords.latitude, location.coords.longitude);

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
  }, [isSafeMode]);

  useEffect(() => {
    loadUserName();
    getCurrentLocation();
  }, [getCurrentLocation]);

  const handlePickFromContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status === 'granted') {
        const contact = await Contacts.presentContactPickerAsync();
        
        if (contact) {
          const firstName = contact?.firstName || '';
          const lastName = contact?.lastName || '';
          const fullName = `${firstName} ${lastName}`.trim() || 'Unknown';
          const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'U';
          
          const phoneNumber = contact?.phoneNumbers && contact.phoneNumbers.length > 0 
            ? contact.phoneNumbers[0]?.number 
            : undefined;
          
          // Demo coordinates: Generate random location near San Francisco Bay Area
          // In a real app, this would come from the contact's stored location or their device
          const newContact: SavedContact = {
            id: contact?.id || Date.now().toString(),
            name: fullName,
            initials: initials,
            phoneNumber: phoneNumber,
            lat: 37.8044 + (Math.random() - 0.5) * 0.1,
            lng: -122.2712 + (Math.random() - 0.5) * 0.1,
          };
          
          setSelectedContact(newContact);
          console.log('Selected contact from device:', newContact.name, phoneNumber);
        }
      } else {
        Alert.alert(
          'Permission Required',
          'Please grant contacts permission to select from your contacts.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error picking contact:', error);
      Alert.alert('Error', 'Failed to access contacts. Please try again.');
    }
  };

  const handleSendInviteSMS = async () => {
    if (!selectedContact) {
      Alert.alert('No Contact Selected', 'Please select a contact first.');
      return;
    }

    if (!selectedContact.phoneNumber) {
      Alert.alert(
        'No Phone Number',
        'This contact does not have a phone number. Please select a different contact or add their phone number.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!myLocation) {
      Alert.alert('Location Required', 'Please wait for your location to be obtained before sending an invite.');
      return;
    }

    if (!selectedMeetupType) {
      Alert.alert('Meetup Type Required', 'Please select a meetup type before sending an invite.');
      return;
    }

    try {
      const isAvailable = await SMS.isAvailableAsync();
      
      if (!isAvailable) {
        Alert.alert(
          'SMS Not Available',
          'SMS is not available on this device. You can manually share the download link:\n\n' + DOWNLOAD_LINK,
          [
            { text: 'Copy Link', onPress: () => console.log('Link copied to clipboard') },
            { text: 'Close' }
          ]
        );
        return;
      }

      // Get coordinates (masked if SafeMeet is on)
      let lat = myLocation.latitude;
      let lng = myLocation.longitude;

      if (isSafeMode) {
        const masked = maskCoordinates(lat, lng);
        lat = masked.lat;
        lng = masked.lng;
        console.log('Masked coordinates for SafeMeet:', masked);
      }

      // Build invite URL with all parameters
      const inviteUrl = `${DOWNLOAD_LINK}/invite?inviterName=${encodeURIComponent(currentUserName)}&lat=${lat}&lng=${lng}&type=${encodeURIComponent(selectedMeetupType)}&safe=${isSafeMode}`;

      console.log('Generated invite URL:', inviteUrl);

      // Build SMS message
      const message = `Hey! I'd like to meet you halfway. Download the MidPoint app and tap this link to share your location and find our meeting spot:\n\n${inviteUrl}`;
      
      const { result } = await SMS.sendSMSAsync(
        [selectedContact.phoneNumber],
        message
      );

      console.log('SMS result:', result);
      
      if (result === 'sent') {
        Alert.alert('Success', 'Invite sent successfully!');
      } else if (result === 'cancelled') {
        console.log('User cancelled SMS');
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      Alert.alert(
        'Error',
        'Failed to send SMS. You can manually share the download link:\n\n' + DOWNLOAD_LINK,
        [{ text: 'OK' }]
      );
    }
  };

  const handleFindMidpoint = async () => {
    if (!myLocation) {
      Alert.alert(
        'Location Required',
        'Both users must enable location to compute a midpoint. Please enable location services.',
        [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'Retry', onPress: getCurrentLocation },
          { text: 'Cancel' }
        ]
      );
      return;
    }

    if (!selectedContact) {
      Alert.alert('No Contact Selected', 'Please select a contact to meet with.');
      return;
    }

    if (!selectedContact.lat || !selectedContact.lng) {
      Alert.alert(
        'Contact Location Missing',
        'The selected contact does not have a location set. Both users must enable location to compute a midpoint.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!selectedMeetupType) {
      Alert.alert('No Meetup Type Selected', 'Please select a meetup type.');
      return;
    }

    try {
      setSearchingPlaces(true);
      setPlaces([]);

      // Calculate midpoint
      const { midLat, midLng } = calculateMidpoint(
        myLocation.latitude,
        myLocation.longitude,
        selectedContact.lat,
        selectedContact.lng,
        isSafeMode
      );

      setMidpointCoords({ lat: midLat, lng: midLng });

      console.log('Searching for places near midpoint:', { midLat, midLng, meetupType: selectedMeetupType });

      // Search for nearby places using Google Places API
      const foundPlaces = await searchNearbyPlaces(midLat, midLng, selectedMeetupType);

      console.log(`Found ${foundPlaces?.length || 0} places`);

      if (!foundPlaces || foundPlaces.length === 0) {
        Alert.alert(
          'No Places Found',
          'No places found near the midpoint. Try selecting a different meetup type or expanding your search area.',
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
          errorMessage = 'Google Places API key not configured. Please add your API key in constants/config.ts to use this feature.';
        } else if (error.message.includes('API request denied')) {
          errorMessage = 'Google Places API access denied. Please check your API key and ensure billing is enabled.';
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

    const url = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}&query_place_id=${place?.placeId || ''}`;
    
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

  const renderMeetupTypeItem = ({ item }: { item: typeof MEETUP_TYPES[0] }) => (
    <TouchableOpacity
      key={item?.id}
      style={[
        styles.dropdownItem,
        { backgroundColor: colors.card, borderColor: colors.border }
      ]}
      onPress={() => {
        setSelectedMeetupType(item?.id);
        setShowMeetupTypeDropdown(false);
      }}
      activeOpacity={0.7}
    >
      <MaterialIcons name={item?.icon || 'place'} size={24} color={colors.primary} />
      <Text style={[styles.dropdownItemText, { color: colors.text }]}>{item?.label || 'Unknown'}</Text>
      {selectedMeetupType === item?.id && (
        <MaterialIcons name="check" size={24} color={colors.success} />
      )}
    </TouchableOpacity>
  );

  const selectedMeetupTypeLabel = MEETUP_TYPES.find(t => t?.id === selectedMeetupType)?.label;

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {isSafeMode && (
          <View style={[styles.safeModeIndicator, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
            <Text style={[styles.safeModeText, { color: colors.success }]}>
              🔒 Safe Meet ON
            </Text>
            <Text style={[styles.safeModeSubtext, { color: colors.textSecondary }]}>
              Your exact location will be hidden
            </Text>
          </View>
        )}

        <Text style={[styles.title, { color: colors.text }]}>Meet in the Middle</Text>

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
              {myLocation.address && !isSafeMode && (
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
              Waiting for location...
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Who are you meeting?</Text>
          
          {selectedContact ? (
            <View style={[styles.selectedContactCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
              <View style={[styles.contactAvatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.contactInitials}>{selectedContact?.initials || 'U'}</Text>
              </View>
              <View style={styles.selectedContactInfo}>
                <Text style={[styles.selectedContactName, { color: colors.text }]}>
                  {selectedContact?.name || 'Unknown'}
                </Text>
                {selectedContact?.phoneNumber && (
                  <Text style={[styles.contactPhoneText, { color: colors.textSecondary }]}>
                    {selectedContact.phoneNumber}
                  </Text>
                )}
              </View>
              <TouchableOpacity 
                onPress={() => setSelectedContact(null)}
                style={styles.removeButton}
              >
                <Text style={[styles.removeButtonText, { color: colors.error }]}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.contactSelectorContainer}>
              <TouchableOpacity
                style={[styles.pickContactButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={handlePickFromContacts}
                activeOpacity={0.7}
              >
                <MaterialIcons name="contacts" size={24} color={colors.primary} />
                <Text style={[styles.pickContactButtonText, { color: colors.primary }]}>
                  Pick from Device Contacts
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {selectedContact && selectedContact.phoneNumber && (
            <TouchableOpacity
              style={[styles.inviteButton, { backgroundColor: colors.secondary }]}
              onPress={handleSendInviteSMS}
              activeOpacity={0.8}
            >
              <Text style={styles.inviteButtonText}>
                📲 Send Invite via SMS
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Meetup Type</Text>
          <TouchableOpacity
            style={[styles.dropdownButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowMeetupTypeDropdown(true)}
            activeOpacity={0.7}
          >
            <MaterialIcons 
              name={selectedMeetupType ? MEETUP_TYPES.find(t => t?.id === selectedMeetupType)?.icon || 'place' : 'place'} 
              size={24} 
              color={selectedMeetupType ? colors.primary : colors.textSecondary} 
            />
            <Text style={[styles.dropdownButtonText, { color: selectedMeetupType ? colors.text : colors.textSecondary }]}>
              {selectedMeetupTypeLabel || 'Select meetup type...'}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.findButton, 
            { backgroundColor: colors.primary },
            (!myLocation || locationLoading || !selectedContact || !selectedMeetupType || searchingPlaces) && styles.findButtonDisabled
          ]}
          onPress={handleFindMidpoint}
          activeOpacity={0.8}
          disabled={!myLocation || locationLoading || !selectedContact || !selectedMeetupType || searchingPlaces}
        >
          {searchingPlaces ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.findButtonText}>Searching...</Text>
            </View>
          ) : (
            <Text style={styles.findButtonText}>
              {isSafeMode ? 'SafeMeet — Hide My Address' : 'Find the MidPoint'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showMeetupTypeDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMeetupTypeDropdown(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMeetupTypeDropdown(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: colors.background }]}>
            <View style={[styles.dropdownHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.dropdownTitle, { color: colors.text }]}>Select Meetup Type</Text>
              <TouchableOpacity onPress={() => setShowMeetupTypeDropdown(false)}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={MEETUP_TYPES}
              renderItem={renderMeetupTypeItem}
              keyExtractor={(item) => item?.id || 'unknown'}
              contentContainerStyle={styles.dropdownList}
            />
          </View>
        </TouchableOpacity>
      </Modal>

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
              
              {selectedContact && (
                <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>
                  Meeting with {selectedContact?.name || 'Unknown'}
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
    </KeyboardAvoidingView>
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
  safeModeIndicator: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 24,
    alignItems: 'center',
  },
  safeModeText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  safeModeSubtext: {
    fontSize: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
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
  section: {
    marginBottom: 28,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  selectedContactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  selectedContactInfo: {
    flex: 1,
  },
  selectedContactName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  contactPhoneText: {
    fontSize: 12,
  },
  removeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  contactSelectorContainer: {
    gap: 12,
  },
  pickContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  pickContactButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  inviteButton: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    boxShadow: '0px 4px 12px rgba(233, 30, 99, 0.3)',
    elevation: 4,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    width: '85%',
    maxHeight: '70%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  dropdownList: {
    padding: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
    gap: 12,
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 16,
  },
  findButton: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    boxShadow: '0px 4px 12px rgba(63, 81, 181, 0.3)',
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

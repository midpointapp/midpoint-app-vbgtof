
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ActivityIndicator,
  Share
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { DOWNLOAD_LINK } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/app/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import type { RealtimeChannel } from '@supabase/supabase-js';

const USER_STORAGE_KEY = '@midpoint_user';

// Dropdown ordering based on mode
const MEETUP_TYPES_SAFE = [
  { id: 'police', label: 'Police station', icon: 'local-police' as const },
  { id: 'gas', label: 'Gas stations', icon: 'local-gas-station' as const },
  { id: 'restaurant', label: 'Food', icon: 'restaurant' as const },
  { id: 'cafe', label: 'Coffee', icon: 'local-cafe' as const },
  { id: 'shopping_mall', label: 'Shopping', icon: 'shopping-cart' as const },
  { id: 'park', label: 'Parks', icon: 'park' as const },
  { id: 'point_of_interest', label: 'Other', icon: 'place' as const },
];

const MEETUP_TYPES_REGULAR = [
  { id: 'restaurant', label: 'Food', icon: 'restaurant' as const },
  { id: 'gas', label: 'Gas stations', icon: 'local-gas-station' as const },
  { id: 'cafe', label: 'Coffee', icon: 'local-cafe' as const },
  { id: 'shopping_mall', label: 'Shopping', icon: 'shopping-cart' as const },
  { id: 'park', label: 'Parks', icon: 'park' as const },
  { id: 'point_of_interest', label: 'Other', icon: 'place' as const },
  { id: 'police', label: 'Police station', icon: 'local-police' as const },
];

interface SavedContact {
  id: string;
  name: string;
  initials: string;
  phoneNumber?: string;
}

interface LocationWithAddress {
  latitude: number;
  longitude: number;
  address?: string;
}

interface MeetPoint {
  id: string;
  meet_point_id: string;
  sender_name: string;
  sender_lat: number;
  sender_lng: number;
  receiver_lat: number | null;
  receiver_lng: number | null;
  type: string;
  safe: boolean;
  status: 'link_sent' | 'joined' | 'ready';
  midpoint_lat: number | null;
  midpoint_lng: number | null;
  hotspot_results: any | null;
  selected_place_id: string | null;
  selected_place_name: string | null;
  selected_place_lat: number | null;
  selected_place_lng: number | null;
  selected_place_address: string | null;
  created_at: string;
  updated_at: string;
}

export default function MeetNowScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const isSafeMode = params?.safeMode === 'true';
  const channelRef = useRef<RealtimeChannel | null>(null);

  const [currentUserName, setCurrentUserName] = useState('User');
  const [selectedContact, setSelectedContact] = useState<SavedContact | null>(null);
  const [selectedMeetupType, setSelectedMeetupType] = useState<string | null>(null);
  const [showMeetupTypeDropdown, setShowMeetupTypeDropdown] = useState(false);
  const [myLocation, setMyLocation] = useState<LocationWithAddress | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [creatingMeetPoint, setCreatingMeetPoint] = useState(false);
  const [currentMeetPoint, setCurrentMeetPoint] = useState<MeetPoint | null>(null);
  const [showReadyBanner, setShowReadyBanner] = useState(false);

  // Select the appropriate dropdown list based on mode
  const MEETUP_TYPES = isSafeMode ? MEETUP_TYPES_SAFE : MEETUP_TYPES_REGULAR;

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

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [getCurrentLocation]);

  const subscribeToMeetPoint = (meetPointId: string) => {
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
            const updatedMeetPoint = payload.new as MeetPoint;
            setCurrentMeetPoint(updatedMeetPoint);

            // Show banner when status changes to joined or ready
            if (updatedMeetPoint.status === 'joined' || updatedMeetPoint.status === 'ready') {
              setShowReadyBanner(true);
            }

            // Navigate to results when ready
            if (updatedMeetPoint.status === 'ready') {
              setTimeout(() => {
                router.push({
                  pathname: '/midpoint-results',
                  params: { meetPointId },
                });
              }, 2000);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    channelRef.current = channel;
  };

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
          
          const newContact: SavedContact = {
            id: contact?.id || Date.now().toString(),
            name: fullName,
            initials: initials,
            phoneNumber: phoneNumber,
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

  const handleCreateAndShareMeetPoint = async () => {
    if (!selectedContact) {
      Alert.alert('No Contact Selected', 'Please select a contact first.');
      return;
    }

    if (!myLocation) {
      Alert.alert('Location Required', 'Please wait for your location to be obtained before creating a Meet Point.');
      return;
    }

    if (!selectedMeetupType) {
      Alert.alert('Meetup Type Required', 'Please select a meetup type before creating a Meet Point.');
      return;
    }

    try {
      setCreatingMeetPoint(true);

      // Generate unique meetPointId
      const meetPointId = uuidv4();

      console.log('Creating MeetPoint:', {
        meetPointId,
        senderName: currentUserName,
        type: selectedMeetupType,
        safe: isSafeMode,
      });

      // Mask coordinates if SafeMeet is on
      let senderLat = myLocation.latitude;
      let senderLng = myLocation.longitude;

      if (isSafeMode) {
        senderLat = Math.round(senderLat * 100) / 100;
        senderLng = Math.round(senderLng * 100) / 100;
        console.log('Masked coordinates for SafeMeet:', { senderLat, senderLng });
      }

      // Create MeetPoint in Supabase
      const { data, error } = await supabase
        .from('meet_points')
        .insert([
          {
            meet_point_id: meetPointId,
            sender_name: currentUserName,
            sender_lat: senderLat,
            sender_lng: senderLng,
            type: selectedMeetupType,
            safe: isSafeMode,
            status: 'link_sent',
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating MeetPoint:', error);
        Alert.alert('Error', 'Failed to create Meet Point. Please try again.');
        setCreatingMeetPoint(false);
        return;
      }

      console.log('MeetPoint created successfully:', data);
      setCurrentMeetPoint(data as MeetPoint);

      // Subscribe to real-time updates
      subscribeToMeetPoint(meetPointId);

      // Generate share link
      const shareUrl = `${DOWNLOAD_LINK}/meet?meetPointId=${meetPointId}`;

      console.log('Generated share URL:', shareUrl);

      // Share the link
      const shareMessage = `Hey ${selectedContact.name}! I'd like to meet you halfway. Open this link to share your location and find our meeting spot:\n\n${shareUrl}`;

      const shareResult = await Share.share({
        message: shareMessage,
        title: 'MidPoint Meet Invite',
      });

      console.log('Share result:', shareResult);

      setCreatingMeetPoint(false);

      if (shareResult.action === Share.sharedAction) {
        Alert.alert(
          'Invite Sent!',
          'Your Meet Point invite has been shared. You\'ll be notified when they open it.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Error creating and sharing MeetPoint:', error);
      setCreatingMeetPoint(false);
      Alert.alert(
        'Error',
        error?.message || 'Failed to create Meet Point. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

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

        {showReadyBanner && currentMeetPoint && (
          <View style={[styles.readyBanner, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
            <MaterialIcons name="check-circle" size={24} color={colors.success} />
            <Text style={[styles.readyBannerText, { color: colors.success }]}>
              Your Meet Point is ready!
            </Text>
          </View>
        )}

        {currentMeetPoint && currentMeetPoint.status === 'link_sent' && (
          <View style={[styles.waitingBanner, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.waitingBannerText, { color: colors.primary }]}>
              Waiting for them to open your Meet Point...
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
            styles.createButton, 
            { backgroundColor: colors.primary },
            (!myLocation || locationLoading || !selectedContact || !selectedMeetupType || creatingMeetPoint) && styles.createButtonDisabled
          ]}
          onPress={handleCreateAndShareMeetPoint}
          activeOpacity={0.8}
          disabled={!myLocation || locationLoading || !selectedContact || !selectedMeetupType || creatingMeetPoint}
        >
          {creatingMeetPoint ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.createButtonText}>Creating...</Text>
            </View>
          ) : (
            <Text style={styles.createButtonText}>
              {isSafeMode ? 'Create Safe Meet Point' : 'Create Meet Point'}
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
  readyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
  },
  readyBannerText: {
    fontSize: 16,
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
  createButton: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    boxShadow: '0px 4px 12px rgba(63, 81, 181, 0.3)',
    elevation: 4,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
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
});

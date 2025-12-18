
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
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSessionAndSendInvite } from '@/utils/sessionUtils';

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

export default function MeetNowScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const isSafeMode = params?.safeMode === 'true';

  // Create mode state
  const [currentUserName, setCurrentUserName] = useState('User');
  const [selectedContact, setSelectedContact] = useState<SavedContact | null>(null);
  const [selectedMeetupType, setSelectedMeetupType] = useState<string | null>(null);
  const [showMeetupTypeDropdown, setShowMeetupTypeDropdown] = useState(false);
  const [myLocation, setMyLocation] = useState<LocationWithAddress | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  
  // "Meet Someone Else" form state
  const [showMeetSomeoneElseModal, setShowMeetSomeoneElseModal] = useState(false);
  const [otherPersonName, setOtherPersonName] = useState('');
  const [otherPersonPhone, setOtherPersonPhone] = useState('');

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

  const handleMeetSomeoneElse = () => {
    setShowMeetSomeoneElseModal(true);
  };

  const handleSubmitMeetSomeoneElse = () => {
    if (!otherPersonName.trim()) {
      Alert.alert('Name Required', 'Please enter a name or label for the person you&apos;re meeting.');
      return;
    }

    // Create a contact object from the form data
    const initials = otherPersonName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2) || 'U';

    const newContact: SavedContact = {
      id: Date.now().toString(),
      name: otherPersonName.trim(),
      initials: initials,
      phoneNumber: otherPersonPhone.trim() || undefined,
    };

    setSelectedContact(newContact);
    setShowMeetSomeoneElseModal(false);
    
    // Reset form
    setOtherPersonName('');
    setOtherPersonPhone('');

    console.log('Created contact for "Meet Someone Else":', newContact);
  };

  const handleCreateSession = async () => {
    if (!selectedContact) {
      Alert.alert('No Contact Selected', 'Please select a contact first.');
      return;
    }

    if (!myLocation) {
      Alert.alert('Location Required', 'Please wait for your location to be obtained before creating a session.');
      return;
    }

    if (!selectedMeetupType) {
      Alert.alert('Meetup Type Required', 'Please select a meetup type before creating a session.');
      return;
    }

    try {
      setCreatingSession(true);

      console.log('[MeetNow] Creating session with new flow...');

      // Create session and send invite
      const sessionId = await createSessionAndSendInvite({
        category: selectedMeetupType,
        senderLat: myLocation.latitude,
        senderLng: myLocation.longitude,
        phoneNumber: selectedContact.phoneNumber,
        recipientName: selectedContact.name,
      });

      if (sessionId) {
        console.log('[MeetNow] Session created successfully:', sessionId);
        
        // Navigate to session screen
        router.push(`/session?sessionId=${sessionId}`);
      }

      setCreatingSession(false);
    } catch (error: any) {
      console.error('[MeetNow] Error creating session:', error);
      setCreatingSession(false);
      Alert.alert(
        'Error',
        error?.message || 'Failed to create session. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const renderMeetupTypeItem = ({ item, index }: { item: typeof MEETUP_TYPES[0]; index: number }) => (
    <TouchableOpacity
      key={item?.id || `meetup-type-${index}`}
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

              <TouchableOpacity
                style={[styles.pickContactButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={handleMeetSomeoneElse}
                activeOpacity={0.7}
              >
                <MaterialIcons name="person-add" size={24} color={colors.primary} />
                <Text style={[styles.pickContactButtonText, { color: colors.primary }]}>
                  Meet Someone Else
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

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[
              styles.createButton, 
              { backgroundColor: colors.primary },
              (!myLocation || locationLoading || !selectedContact || !selectedMeetupType || creatingSession) && styles.createButtonDisabled
            ]}
            onPress={handleCreateSession}
            activeOpacity={0.8}
            disabled={!myLocation || locationLoading || !selectedContact || !selectedMeetupType || creatingSession}
          >
            {creatingSession ? (
              <View style={styles.loadingButtonContainer}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.createButtonText}>Creating...</Text>
              </View>
            ) : (
              <Text style={styles.createButtonText}>
                {isSafeMode ? 'Send Safe Meet Invite' : 'Send Meet Invite'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Meetup Type Dropdown Modal */}
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
              keyExtractor={(item, index) => item?.id || `meetup-type-${index}`}
              contentContainerStyle={styles.dropdownList}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Meet Someone Else Modal */}
      <Modal
        visible={showMeetSomeoneElseModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMeetSomeoneElseModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowMeetSomeoneElseModal(false)}
          >
            <TouchableOpacity 
              style={[styles.meetSomeoneElseModal, { backgroundColor: colors.background }]}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Meet Someone Else</Text>
                <TouchableOpacity onPress={() => setShowMeetSomeoneElseModal(false)}>
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.formContent}>
                <Text style={[styles.formDescription, { color: colors.textSecondary }]}>
                  Meeting someone who&apos;s not in your contacts? Enter their details below.
                </Text>

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Name / Label <Text style={{ color: colors.error }}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    placeholder="e.g., Facebook Buyer, Marketplace Seller"
                    placeholderTextColor={colors.textSecondary}
                    value={otherPersonName}
                    onChangeText={setOtherPersonName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Phone Number (Optional)
                  </Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    placeholder="e.g., +1 234 567 8900"
                    placeholderTextColor={colors.textSecondary}
                    value={otherPersonPhone}
                    onChangeText={setOtherPersonPhone}
                    keyboardType="phone-pad"
                  />
                  <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
                    Only used to pre-fill SMS if provided
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: colors.primary }]}
                  onPress={handleSubmitMeetSomeoneElse}
                  activeOpacity={0.8}
                >
                  <Text style={styles.submitButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
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
  loadingButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  buttonGroup: {
    marginTop: 16,
    gap: 12,
  },
  createButton: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
  meetSomeoneElseModal: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  formContent: {
    padding: 20,
  },
  formDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  formField: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  fieldHint: {
    fontSize: 12,
    marginTop: 6,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

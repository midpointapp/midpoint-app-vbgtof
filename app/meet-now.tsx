
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';

interface SavedContact {
  id: string;
  name: string;
  initials: string;
  lat?: number;
  lng?: number;
}

export default function MeetNowScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const isSafeMode = params.safeMode === 'true';

  const [selectedContact, setSelectedContact] = useState<SavedContact | null>(null);
  const [type, setType] = useState('');
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([
    { id: '1', name: 'Mom', initials: 'M', lat: 37.8044, lng: -122.2712 },
    { id: '2', name: 'Sarah', initials: 'S', lat: 37.7749, lng: -122.4194 },
    { id: '3', name: 'Chris', initials: 'C', lat: 37.8715, lng: -122.2730 },
    { id: '4', name: 'Alex', initials: 'A', lat: 37.7897, lng: -122.3453 },
  ]);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      setLocationError(null);

      // Request foreground permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setLocationError('Location permission denied');
        Alert.alert(
          'Permission Required',
          'Please grant location permission to use MidPoint. Your location is needed to calculate the meeting point.',
          [{ text: 'OK' }]
        );
        setLocationLoading(false);
        return;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setMyLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      console.log('Current location obtained:', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setLocationLoading(false);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Failed to get location');
      Alert.alert(
        'Location Error',
        'Unable to get your current location. Please make sure location services are enabled.',
        [{ text: 'OK' }]
      );
      setLocationLoading(false);
    }
  };

  const handleSelectContact = (contact: SavedContact) => {
    setSelectedContact(contact);
    console.log('Selected contact:', contact.name);
  };

  const handlePickFromContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status === 'granted') {
        const contact = await Contacts.presentContactPickerAsync();
        
        if (contact) {
          const firstName = contact.firstName || '';
          const lastName = contact.lastName || '';
          const fullName = `${firstName} ${lastName}`.trim() || 'Unknown';
          const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'U';
          
          const newContact: SavedContact = {
            id: contact.id || Date.now().toString(),
            name: fullName,
            initials: initials,
            // Note: Device contacts don't have location data by default
            // In a real app, you'd need to store this separately or ask the user
          };
          
          setSelectedContact(newContact);
          console.log('Selected contact from device:', newContact.name);
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

  const handleFind = () => {
    if (!myLocation) {
      Alert.alert(
        'Location Required',
        'Please wait while we get your current location, or enable location services.',
        [
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

    // Calculate midpoint using my device location and contact's location
    const userA = {
      name: 'You',
      lat: myLocation.latitude,
      lng: myLocation.longitude,
    };

    const userB = {
      name: selectedContact.name,
      lat: selectedContact.lat || myLocation.latitude, // Fallback if contact has no location
      lng: selectedContact.lng || myLocation.longitude,
    };

    const midpointLat = (userA.lat + userB.lat) / 2;
    const midpointLng = (userA.lng + userB.lng) / 2;

    console.log('Find midpoint with:', { 
      userA,
      userB,
      midpoint: { lat: midpointLat, lng: midpointLng },
      type,
      safeMode: isSafeMode 
    });
    
    if (isSafeMode) {
      console.log('Safe Meet mode: Only public locations will be suggested');
    }
    
    Alert.alert(
      'Midpoint Calculated',
      `Meeting point between you and ${selectedContact.name}:\n\nLatitude: ${midpointLat.toFixed(4)}\nLongitude: ${midpointLng.toFixed(4)}`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
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

      {/* My Location Status */}
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
            <Text style={[styles.coordinatesText, { color: colors.textSecondary }]}>
              {myLocation.latitude.toFixed(4)}, {myLocation.longitude.toFixed(4)}
            </Text>
          </View>
        ) : (
          <Text style={[styles.locationText, { color: colors.textSecondary }]}>
            {locationError || 'Waiting for location...'}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>Who are you meeting?</Text>
        
        {selectedContact ? (
          <View style={[styles.selectedContactCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <View style={[styles.contactAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.contactInitials}>{selectedContact.initials}</Text>
            </View>
            <View style={styles.selectedContactInfo}>
              <Text style={[styles.selectedContactName, { color: colors.text }]}>
                {selectedContact.name}
              </Text>
              {selectedContact.lat && selectedContact.lng && (
                <Text style={[styles.contactLocationText, { color: colors.textSecondary }]}>
                  Location: {selectedContact.lat.toFixed(4)}, {selectedContact.lng.toFixed(4)}
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
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Select from saved contacts:
            </Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.contactList}
              contentContainerStyle={styles.contactListContent}
            >
              {savedContacts.map((contact) => (
                <TouchableOpacity
                  key={contact.id}
                  style={styles.contactItem}
                  onPress={() => handleSelectContact(contact)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.contactCircle, { backgroundColor: colors.primary }]}>
                    <Text style={styles.contactInitials}>{contact.initials}</Text>
                  </View>
                  <Text style={[styles.contactName, { color: colors.text }]} numberOfLines={1}>
                    {contact.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.pickContactButton, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={handlePickFromContacts}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickContactButtonText, { color: colors.primary }]}>
                📱 Pick from Device Contacts
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>Type of meetup</Text>
        <TextInput
          style={[styles.input, { 
            backgroundColor: colors.card, 
            color: colors.text,
            borderColor: colors.border 
          }]}
          placeholder="Ex: Coffee, Meal, Marketplace Sale"
          placeholderTextColor={colors.textSecondary}
          value={type}
          onChangeText={setType}
        />
      </View>

      <TouchableOpacity
        style={[
          styles.findButton, 
          { backgroundColor: colors.primary },
          (!myLocation || locationLoading) && styles.findButtonDisabled
        ]}
        onPress={handleFind}
        activeOpacity={0.8}
        disabled={!myLocation || locationLoading}
      >
        <Text style={styles.findButtonText}>
          {locationLoading ? 'Getting Location...' : 'Find Midpoint'}
        </Text>
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
    paddingBottom: 100,
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
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  coordinatesText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  section: {
    marginBottom: 28,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
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
  selectedContactInfo: {
    flex: 1,
  },
  selectedContactName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  contactLocationText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
  contactList: {
    marginBottom: 16,
  },
  contactListContent: {
    gap: 16,
    paddingRight: 16,
  },
  contactItem: {
    alignItems: 'center',
    gap: 8,
    width: 80,
  },
  contactCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInitials: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  contactName: {
    fontSize: 14,
    textAlign: 'center',
  },
  pickContactButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  pickContactButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
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
});

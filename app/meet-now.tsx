
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { createSessionAndSendInvite } from '@/utils/sessionUtils';
import * as Location from 'expo-location';
import { useThemeColors } from '@/styles/commonStyles';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  ActivityIndicator,
} from 'react-native';

const MEETUP_TYPES = [
  { id: 'coffee', label: '☕ Coffee', icon: 'local-cafe' },
  { id: 'food', label: '🍔 Food', icon: 'restaurant' },
  { id: 'marketplace', label: '🛍️ Marketplace', icon: 'shopping-bag' },
  { id: 'gas', label: '⛽ Gas Station', icon: 'local-gas-station' },
  { id: 'park', label: '🌳 Park', icon: 'park' },
  { id: 'police', label: '🚔 Police Station', icon: 'local-police' },
];

export default function MeetNowScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [selectedType, setSelectedType] = useState('coffee');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  async function getCurrentLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      console.log('[MeetNow] Location acquired');
    } catch (error: any) {
      Alert.alert('Location Error', 'Unable to get your location.');
    }
  }

  async function handleCreateSession() {
    if (!location) {
      Alert.alert('Location Required', 'Please enable location services.');
      return;
    }

    console.log('[MeetNow] Creating session, type:', selectedType);
    setCreatingSession(true);
    try {
      const sessionData = await createSessionAndSendInvite(
        selectedType,
        location.coords.latitude,
        location.coords.longitude
      );

      console.log('[MeetNow] Session created, navigating to session screen');
      router.push(`/session?sessionId=${sessionData.id}&token=${sessionData.invite_token}&isSender=true`);
    } catch (error: any) {
      Alert.alert('Session Error', error?.message ?? 'Unable to create session');
    } finally {
      setCreatingSession(false);
    }
  }

  const locationReady = location !== null;
  const buttonLabel = creatingSession
    ? 'Creating...'
    : !locationReady
    ? 'Getting location...'
    : 'Create & Send Invite';
  const locationStatusText = locationReady ? '📍 Location ready' : '📍 Getting your location...';
  const locationStatusColor = locationReady ? '#4CAF50' : colors.textSecondary;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            console.log('[MeetNow] Back button pressed');
            router.back();
          }}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Meet Now</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Meeting Type</Text>

      <View style={styles.typeGrid}>
        {MEETUP_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.typeCard,
              { backgroundColor: colors.card },
              selectedType === type.id && styles.typeCardSelected,
            ]}
            onPress={() => {
              console.log('[MeetNow] Selected type:', type.id);
              setSelectedType(type.id);
            }}
          >
            <MaterialIcons
              name={type.icon as any}
              size={32}
              color={selectedType === type.id ? '#007AFF' : colors.text}
            />
            <Text style={[styles.typeLabel, { color: colors.text }]}>{type.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.locationStatus, { color: locationStatusColor }]}>
        {locationStatusText}
      </Text>

      <TouchableOpacity
        style={[styles.createButton, (creatingSession || !locationReady) && styles.createButtonDisabled]}
        onPress={handleCreateSession}
        disabled={creatingSession || !locationReady}
      >
        {creatingSession ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createButtonText}>{buttonLabel}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { marginRight: 15 },
  title: { fontSize: 24, fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 15 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  typeCard: { width: '30%', padding: 18, borderRadius: 12, alignItems: 'center' },
  typeCardSelected: { borderWidth: 2, borderColor: '#007AFF' },
  typeLabel: { fontSize: 13, marginTop: 8, textAlign: 'center' },
  locationStatus: { fontSize: 13, marginBottom: 20, textAlign: 'center' },
  createButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center' },
  createButtonDisabled: { opacity: 0.5 },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});


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
      console.log('[MeetNow] Location:', loc.coords);
    } catch (error: any) {
      console.error('[MeetNow] Location error:', error.message);
      Alert.alert('Location Error', 'Unable to get your location.');
    }
  }

  async function handleCreateSession() {
    if (!location) {
      Alert.alert('Location Required', 'Please enable location services.');
      return;
    }

    setCreatingSession(true);
    try {
      const sessionData = await createSessionAndSendInvite(
        selectedType,
        location.coords.latitude,
        location.coords.longitude
      );

      console.log('[MeetNow] ✅ Session created:', sessionData.id);
      console.log('[MeetNow] ✅ Navigating sender to /session (in-app)');
      
      // CRITICAL FIX: Keep existing sender in-app navigation to /session
      router.push(`/session?sessionId=${sessionData.id}&token=${sessionData.invite_token}`);
    } catch (error: any) {
      console.error('[MeetNow] Error:', error.message);
      Alert.alert('Session Error', error?.message ?? 'Unable to create session');
    } finally {
      setCreatingSession(false);
    }
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
            onPress={() => setSelectedType(type.id)}
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

      <TouchableOpacity
        style={[styles.createButton, creatingSession && styles.createButtonDisabled]}
        onPress={handleCreateSession}
        disabled={creatingSession || !location}
      >
        {creatingSession ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createButtonText}>Create & Send Invite</Text>
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
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 30 },
  typeCard: { width: '30%', padding: 15, borderRadius: 12, alignItems: 'center' },
  typeCardSelected: { borderWidth: 2, borderColor: '#007AFF' },
  typeLabel: { fontSize: 12, marginTop: 8, textAlign: 'center' },
  createButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center' },
  createButtonDisabled: { opacity: 0.5 },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

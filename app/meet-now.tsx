import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { createSessionAndSendInvite } from '@/utils/sessionUtils';
import * as Location from 'expo-location';
import { useThemeColors } from '@/styles/commonStyles';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';

const MEETUP_TYPES = [
  { id: 'coffee', label: 'Coffee', icon: 'local-cafe' },
  { id: 'food', label: 'Food', icon: 'restaurant' },
  { id: 'marketplace', label: 'Marketplace', icon: 'shopping-bag' },
  { id: 'gas', label: 'Gas Station', icon: 'local-gas-station' },
  { id: 'park', label: 'Park', icon: 'park' },
  { id: 'police', label: 'Police Station', icon: 'local-police' },
];

export default function MeetNowScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [selectedType, setSelectedType] = useState('coffee');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);

  async function getCurrentLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Please enable location access in Settings to use this feature.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      console.log('[MeetNow] Location acquired');
    } catch (error: any) {
      Alert.alert('Location Error', 'Unable to get your location.');
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => getCurrentLocation(), 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateSession() {
    if (!location) {
      Alert.alert('Location Required', 'Please enable location services.');
      return;
    }
    if (creatingSession) return;
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
  const buttonLabel = creatingSession ? 'Creating...' : !locationReady ? 'Getting location...' : 'Create & Send Invite';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Meeting Type</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>What kind of place would you like to meet?</Text>
      <View style={styles.typeGrid}>
        {MEETUP_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedType === type.id }}
            style={[styles.typeCard, { backgroundColor: colors.card }, selectedType === type.id && styles.typeCardSelected]}
            onPress={() => setSelectedType(type.id)}
          >
            <MaterialIcons name={type.icon as any} size={30} color={selectedType === type.id ? '#4055AD' : colors.text} />
            <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.typeLabel, { color: colors.text }]}>{type.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.locationStatus, { color: locationReady ? '#388E3C' : colors.textSecondary }]}>
        {locationReady ? '📍 Location ready' : '📍 Getting your location...'}
      </Text>
      <TouchableOpacity
        style={[styles.createButton, (creatingSession || !locationReady) && styles.createButtonDisabled]}
        onPress={handleCreateSession}
        disabled={creatingSession || !locationReady}
      >
        {creatingSession ? <ActivityIndicator color="#fff" /> : <Text style={styles.createButtonText}>{buttonLabel}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 22 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  typeCard: { width: '30%', flexGrow: 1, minWidth: 0, minHeight: 116, paddingHorizontal: 6, paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  typeCardSelected: { borderColor: '#4055AD' },
  typeLabel: { fontSize: 13, fontWeight: '500', marginTop: 10, textAlign: 'center', width: '100%', flexShrink: 1 },
  locationStatus: { fontSize: 14, marginBottom: 20, textAlign: 'center' },
  createButton: { backgroundColor: '#4055AD', padding: 17, borderRadius: 14, alignItems: 'center' },
  createButtonDisabled: { opacity: 0.5 },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

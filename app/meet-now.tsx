
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState, useEffect } from 'react';
import { createSessionAndSendInvite, shareInviteUrl } from '@/utils/sessionUtils';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';

const MEETUP_TYPES = [
  { id: 'coffee', label: 'Coffee', icon: 'local-cafe' as const },
  { id: 'food', label: 'Food', icon: 'restaurant' as const },
  { id: 'safe', label: 'Safe Meet', icon: 'local-police' as const },
];

export default function MeetNowScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [selectedType, setSelectedType] = useState('coffee');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      setLoadingLocation(true);
      setLocationError(null);
      
      console.log('[MeetNow] Requesting location permission...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        const errorMsg = 'Location permission is required to create a meeting point.';
        console.error('[MeetNow] Permission denied');
        setLocationError(errorMsg);
        Alert.alert('Permission Denied', errorMsg);
        setLoadingLocation(false);
        return;
      }

      console.log('[MeetNow] Getting current position...');
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      console.log('[MeetNow] ✅ Location obtained:', {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
    } catch (error: any) {
      console.error('[MeetNow] ❌ Error getting location:', error);
      const errorMsg = 'Failed to get your location. Please try again.';
      setLocationError(errorMsg);
      Alert.alert('Location Error', errorMsg);
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleCreateSession = async () => {
    if (!location) {
      Alert.alert('Location Required', 'Please enable location services to create a session.');
      return;
    }

    setCreatingSession(true);
    console.log('[MeetNow] 🚀 Starting session creation:', { 
      selectedType, 
      location,
      timestamp: new Date().toISOString()
    });

    try {
      // Create session
      console.log('[MeetNow] Step 1: Creating session in database...');
      const { sessionId, inviteUrl } = await createSessionAndSendInvite(
        selectedType,
        location.latitude,
        location.longitude
      );

      console.log('[MeetNow] ✅ Step 1 complete. Session ID:', sessionId);

      // Share the invite
      console.log('[MeetNow] Step 2: Sharing invite URL...');
      await shareInviteUrl(inviteUrl);
      console.log('[MeetNow] ✅ Step 2 complete. Invite shared.');

      // Navigate to session screen
      console.log('[MeetNow] Step 3: Navigating to session screen...');
      router.push(`/session?sessionId=${sessionId}`);
      console.log('[MeetNow] ✅ All steps complete!');

    } catch (error: any) {
      console.error('[MeetNow] ❌ Session creation failed:', {
        error: error,
        message: error.message,
        stack: error.stack,
      });
      
      Alert.alert(
        'Failed to Create Session',
        error.message || 'An unexpected error occurred. Please try again.',
        [
          { 
            text: 'Retry', 
            onPress: handleCreateSession,
            style: 'default'
          },
          { 
            text: 'Cancel', 
            style: 'cancel'
          }
        ]
      );
    } finally {
      setCreatingSession(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Create Meeting Point</Text>
        
        {loadingLocation ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Getting your location...
            </Text>
          </View>
        ) : locationError ? (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error" size={48} color={colors.error || '#f44336'} />
            <Text style={[styles.errorText, { color: colors.error || '#f44336' }]}>
              {locationError}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={getCurrentLocation}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Select meeting type:
            </Text>

            <View style={styles.typesContainer}>
              {MEETUP_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeCard,
                    { backgroundColor: colors.card },
                    selectedType === type.id && { borderColor: colors.primary, borderWidth: 2 },
                  ]}
                  onPress={() => setSelectedType(type.id)}
                  disabled={creatingSession}
                >
                  <MaterialIcons name={type.icon} size={32} color={colors.primary} />
                  <Text style={[styles.typeLabel, { color: colors.text }]}>{type.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.createButton,
                { backgroundColor: colors.primary },
                creatingSession && styles.createButtonDisabled,
              ]}
              onPress={handleCreateSession}
              disabled={creatingSession}
            >
              {creatingSession ? (
                <View style={styles.loadingButtonContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.createButtonText, { marginLeft: 8 }]}>
                    Creating session...
                  </Text>
                </View>
              ) : (
                <Text style={styles.createButtonText}>Create & Send Invite</Text>
              )}
            </TouchableOpacity>

            {location && (
              <Text style={[styles.locationInfo, { color: colors.textSecondary }]}>
                📍 Location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </Text>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 16,
  },
  typesContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  typeCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  locationInfo: {
    marginTop: 16,
    fontSize: 12,
    textAlign: 'center',
  },
});


import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  Linking,
  useColorScheme,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';

const mockSessions = [
  {
    id: '1',
    title: 'Coffee with Sarah',
    category: 'Coffee',
    status: 'active',
    created_at: '2024-01-15T10:00:00Z',
    invite_code: 'ABC123',
  },
  {
    id: '2',
    title: 'Lunch with Team',
    category: 'Meal',
    status: 'completed',
    created_at: '2024-01-10T12:00:00Z',
    invite_code: 'XYZ789',
  },
];

const mockParticipants = [
  {
    id: '1',
    session_id: '1',
    user_name: 'You',
    user_lat: null,
    user_lng: null,
    isCurrentUser: true,
  },
  {
    id: '2',
    session_id: '1',
    user_name: 'Sarah Smith',
    user_lat: 37.8044,
    user_lng: -122.2712,
    isCurrentUser: false,
  },
];

const mockSpots = [
  {
    id: '1',
    session_id: '1',
    name: 'Blue Bottle Coffee',
    category: 'Coffee',
    lat: 37.7897,
    lng: -122.3453,
    address: '123 Main St, San Francisco, CA',
    distance: 2.5,
  },
  {
    id: '2',
    session_id: '1',
    name: 'Starbucks Reserve',
    category: 'Coffee',
    lat: 37.7900,
    lng: -122.3450,
    address: '456 Market St, San Francisco, CA',
    distance: 2.7,
  },
  {
    id: '3',
    session_id: '1',
    name: 'Philz Coffee',
    category: 'Coffee',
    lat: 37.7895,
    lng: -122.3455,
    address: '789 Mission St, San Francisco, CA',
    distance: 2.3,
  },
];

function calculateMidpoint(participants: any[]) {
  const validParticipants = participants.filter(
    (p) => p.user_lat && p.user_lng
  );

  if (validParticipants.length === 0) {
    return null;
  }

  const sumLat = validParticipants.reduce((sum, p) => sum + p.user_lat, 0);
  const sumLng = validParticipants.reduce((sum, p) => sum + p.user_lng, 0);

  return {
    latitude: sumLat / validParticipants.length,
    longitude: sumLng / validParticipants.length,
  };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function SessionScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { id } = useLocalSearchParams();
  const [refreshing, setRefreshing] = useState(false);
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  const colors = {
    background: isDark ? '#121212' : '#F5F5F5',
    text: isDark ? '#FFFFFF' : '#212121',
    textSecondary: isDark ? '#B0B0B0' : '#757575',
    primary: '#3F51B5',
    secondary: '#E91E63',
    accent: '#03A9F4',
    success: '#4CAF50',
    card: isDark ? '#212121' : '#FFFFFF',
    border: isDark ? '#424242' : '#E0E0E0',
    error: '#F44336',
  };

  const session = mockSessions.find((s) => s.id === id);
  let participants = mockParticipants.filter((p) => p.session_id === id);
  
  if (myLocation) {
    participants = participants.map((p) => {
      if (p.isCurrentUser) {
        return {
          ...p,
          user_lat: myLocation.latitude,
          user_lng: myLocation.longitude,
        };
      }
      return p;
    });
  }

  const midpoint = calculateMidpoint(participants);
  
  let spotsWithDistance = mockSpots.filter((s) => s.session_id === id);
  if (midpoint) {
    spotsWithDistance = spotsWithDistance.map((spot) => ({
      ...spot,
      distance: calculateDistance(midpoint.latitude, midpoint.longitude, spot.lat, spot.lng),
    })).sort((a, b) => a.distance - b.distance);
  }

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      setLocationError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setLocationError('Location access denied. Please enable it in Settings to use MidPoint.');
        console.log('Location permission denied');
        setLocationLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setMyLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      console.log('Location obtained for session:', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setLocationLoading(false);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Failed to get location. Please check your location services.');
      setLocationLoading(false);
    }
  };

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Session not found</Text>
      </View>
    );
  }

  const handleRefreshMidpoint = async () => {
    setRefreshing(true);
    console.log('Refreshing midpoint...');
    
    await getCurrentLocation();
    
    setTimeout(() => {
      setRefreshing(false);
      if (myLocation) {
        Alert.alert('Success', 'Midpoint refreshed with your current location!');
      }
    }, 1000);
  };

  const handleNavigate = (spot: any) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`;
    Linking.openURL(url).catch((err) =>
      console.error('Error opening maps:', err)
    );
  };

  const handleInviteMore = () => {
    const inviteLink = `https://midpoint.app/invite/${session.invite_code}`;
    Alert.alert(
      'Invite More People',
      `Share this link:\n\n${inviteLink}`,
      [
        { text: 'Copy Link', onPress: () => console.log('Link copied') },
        { text: 'Close' },
      ]
    );
  };

  const allUsersHaveLocation = participants.every((p) => p.user_lat && p.user_lng);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'android' && { paddingTop: 48 },
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card }]}>
            <MaterialIcons name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.sessionTitle, { color: colors.text }]}>{session.title}</Text>
            <Text style={[styles.sessionCategory, { color: colors.primary }]}>{session.category}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Participants</Text>
          {participants.map((participant, index) => (
            <React.Fragment key={participant.id}>
              <View style={styles.participantItem}>
                <View style={[styles.participantAvatar, { backgroundColor: colors.primary }]}>
                  <MaterialIcons name="person" size={24} color={colors.card} />
                </View>
                <View style={styles.participantInfo}>
                  <Text style={[styles.participantName, { color: colors.text }]}>
                    {participant.user_name}
                    {participant.isCurrentUser && ' (You)'}
                  </Text>
                  {participant.isCurrentUser && locationLoading && (
                    <Text style={[styles.participantStatus, { color: colors.textSecondary }]}>
                      Getting location...
                    </Text>
                  )}
                  {participant.isCurrentUser && locationError && (
                    <Text style={[styles.participantStatus, { color: colors.error }]}>
                      {locationError}
                    </Text>
                  )}
                </View>
                {participant.user_lat && participant.user_lng ? (
                  <MaterialIcons name="location-on" size={20} color={colors.success} />
                ) : (
                  <MaterialIcons name="location-off" size={20} color={colors.error} />
                )}
              </View>
              {index < participants.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            </React.Fragment>
          ))}
          
          {!allUsersHaveLocation && (
            <View style={[styles.warningBox, { backgroundColor: colors.error + '20', borderColor: colors.error }]}>
              <MaterialIcons name="warning" size={20} color={colors.error} />
              <Text style={[styles.warningText, { color: colors.error }]}>
                Both users must enable location to compute a midpoint.
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.midpointHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Midpoint Location</Text>
            <TouchableOpacity
              onPress={handleRefreshMidpoint}
              disabled={refreshing}
              style={styles.refreshButton}
            >
              <MaterialIcons name="refresh" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {midpoint ? (
            <View>
              <View style={[styles.mapPlaceholder, { backgroundColor: colors.background }]}>
                <MaterialIcons name="map" size={48} color={colors.primary} />
                <Text style={[styles.mapText, { color: colors.textSecondary }]}>
                  Note: react-native-maps is not supported in Natively.
                </Text>
                <Text style={[styles.coordinatesText, { color: colors.text }]}>
                  Midpoint: {midpoint.latitude.toFixed(4)}, {midpoint.longitude.toFixed(4)}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.openMapsButton, { backgroundColor: colors.accent }]}
                onPress={() => {
                  const url = `https://www.google.com/maps/search/?api=1&query=${midpoint.latitude},${midpoint.longitude}`;
                  Linking.openURL(url);
                }}
              >
                <MaterialIcons name="map" size={20} color="#FFFFFF" />
                <Text style={styles.openMapsButtonText}>Open in Maps</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={[styles.noMidpointText, { color: colors.textSecondary }]}>
                Waiting for participant locations...
              </Text>
              {locationLoading && (
                <Text style={[styles.noMidpointText, { color: colors.textSecondary }]}>
                  Getting your location...
                </Text>
              )}
              {locationError && (
                <TouchableOpacity 
                  style={[styles.settingsButton, { backgroundColor: colors.primary }]}
                  onPress={() => Linking.openSettings()}
                >
                  <Text style={styles.settingsButtonText}>Open Settings</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Nearby Meeting Places</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            Public locations near the midpoint
          </Text>
          {midpoint && spotsWithDistance.length > 0 ? (
            spotsWithDistance.map((spot, index) => (
              <React.Fragment key={spot.id}>
                <View style={styles.spotItem}>
                  <View style={[styles.spotIcon, { backgroundColor: colors.background }]}>
                    <MaterialIcons name="place" size={24} color={colors.secondary} />
                  </View>
                  <View style={styles.spotInfo}>
                    <Text style={[styles.spotName, { color: colors.text }]}>{spot.name}</Text>
                    <Text style={[styles.spotCategory, { color: colors.primary }]}>{spot.category}</Text>
                    {spot.address && (
                      <Text style={[styles.spotAddress, { color: colors.textSecondary }]}>{spot.address}</Text>
                    )}
                    <Text style={[styles.spotDistance, { color: colors.textSecondary }]}>
                      {spot.distance.toFixed(2)} km from midpoint
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.navigateButton}
                    onPress={() => handleNavigate(spot)}
                  >
                    <MaterialIcons name="navigation" size={32} color={colors.accent} />
                  </TouchableOpacity>
                </View>
                {index < spotsWithDistance.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              </React.Fragment>
            ))
          ) : !midpoint ? (
            <Text style={[styles.noSpotsText, { color: colors.textSecondary }]}>
              Calculate midpoint first to see nearby places.
            </Text>
          ) : (
            <Text style={[styles.noSpotsText, { color: colors.textSecondary }]}>
              No spots found. Try refreshing the midpoint.
            </Text>
          )}
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.outlineButton, styles.actionButton, { borderColor: colors.primary }]}
            onPress={handleInviteMore}
          >
            <MaterialIcons name="person-add" size={20} color={colors.primary} />
            <Text style={[styles.outlineButtonText, styles.actionButtonText, { color: colors.primary }]}>
              Invite More
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sessionCategory: {
    fontSize: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  cardSubtitle: {
    fontSize: 14,
    marginBottom: 12,
    marginTop: -8,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
  },
  participantStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  midpointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  refreshButton: {
    padding: 8,
  },
  mapPlaceholder: {
    height: 200,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginBottom: 12,
  },
  mapText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  coordinatesText: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  openMapsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  noMidpointText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  spotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  spotIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotInfo: {
    flex: 1,
  },
  spotName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  spotCategory: {
    fontSize: 14,
    marginBottom: 2,
  },
  spotAddress: {
    fontSize: 12,
    marginBottom: 2,
  },
  spotDistance: {
    fontSize: 12,
    fontWeight: '600',
  },
  navigateButton: {
    padding: 4,
  },
  noSpotsText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  outlineButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonText: {
    marginLeft: 0,
  },
});


import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  Linking,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { useThemeColors } from '@/styles/commonStyles';

interface Participant {
  id: string;
  session_id: string;
  user_name: string;
  user_lat: number | null;
  user_lng: number | null;
  isCurrentUser: boolean;
}

interface Spot {
  id: string;
  session_id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address?: string;
  distance?: number;
}

const SAMPLE_SPOTS: Spot[] = [
  {
    id: '1',
    session_id: '1',
    name: 'Blue Bottle Coffee',
    category: 'Coffee',
    lat: 37.7897,
    lng: -122.3453,
    address: '300 Webster St, Oakland, CA 94607',
    distance: 2.5,
  },
  {
    id: '2',
    session_id: '1',
    name: 'Starbucks Reserve',
    category: 'Coffee',
    lat: 37.7900,
    lng: -122.3450,
    address: '350 Grand Ave, Oakland, CA 94610',
    distance: 2.7,
  },
  {
    id: '3',
    session_id: '1',
    name: 'Philz Coffee',
    category: 'Coffee',
    lat: 37.7895,
    lng: -122.3455,
    address: '789 Mission St, San Francisco, CA 94103',
    distance: 2.3,
  },
];

function calculateMidpoint(participants: Participant[]) {
  const validParticipants = participants.filter(
    (p) => p.user_lat !== null && p.user_lng !== null
  );

  if (validParticipants.length === 0) {
    return null;
  }

  const sumLat = validParticipants.reduce((sum, p) => sum + (p.user_lat || 0), 0);
  const sumLng = validParticipants.reduce((sum, p) => sum + (p.user_lng || 0), 0);

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
  const colors = useThemeColors();
  const params = useLocalSearchParams();
  const { id, midpointLat, midpointLng, contactName, type, safeMode } = params;
  
  const [refreshing, setRefreshing] = useState(false);
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [midpointAddress, setMidpointAddress] = useState<string | null>(null);

  const isSafeMode = safeMode === 'true';
  const sessionTitle = contactName ? `Meeting with ${contactName}` : 'MidPoint Session';
  const sessionCategory = type || 'General';

  const initialParticipants: Participant[] = useMemo(() => [
    {
      id: '1',
      session_id: id as string,
      user_name: 'You',
      user_lat: null,
      user_lng: null,
      isCurrentUser: true,
    },
    {
      id: '2',
      session_id: id as string,
      user_name: contactName as string || 'Contact',
      user_lat: midpointLat ? parseFloat(midpointLat as string) * 2 - (myLocation?.latitude || 37.7749) : 37.8044,
      user_lng: midpointLng ? parseFloat(midpointLng as string) * 2 - (myLocation?.longitude || -122.4194) : -122.2712,
      isCurrentUser: false,
    },
  ], [id, contactName, midpointLat, midpointLng, myLocation]);

  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (myLocation) {
      setParticipants(prev => prev.map(p => 
        p.isCurrentUser 
          ? { ...p, user_lat: myLocation.latitude, user_lng: myLocation.longitude }
          : p
      ));
    }
  }, [myLocation]);

  const midpoint = useMemo(() => {
    if (midpointLat && midpointLng) {
      return { latitude: parseFloat(midpointLat as string), longitude: parseFloat(midpointLng as string) };
    }
    return calculateMidpoint(participants);
  }, [midpointLat, midpointLng, participants]);
  
  const spotsWithDistance = useMemo(() => {
    let spots = SAMPLE_SPOTS.filter((s) => s.session_id === id);
    if (midpoint) {
      spots = spots.map((spot) => ({
        ...spot,
        distance: calculateDistance(midpoint.latitude, midpoint.longitude, spot.lat, spot.lng),
      })).sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }
    return spots;
  }, [id, midpoint]);

  useEffect(() => {
    if (midpoint) {
      reverseGeocodeMidpoint(midpoint.latitude, midpoint.longitude);
    }
  }, [midpoint]);

  const reverseGeocodeMidpoint = async (latitude: number, longitude: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      
      if (results && results.length > 0) {
        const address = results[0];
        const parts = [
          address.streetNumber,
          address.street,
          address.city,
          address.region,
          address.postalCode,
        ].filter(Boolean);
        
        const formattedAddress = parts.join(', ');
        setMidpointAddress(formattedAddress || null);
        console.log('Midpoint address:', formattedAddress);
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      setMidpointAddress(null);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      setLocationError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setLocationError('Location access denied. Enable in Settings.');
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
      setLocationError('Failed to get location. Check location services.');
      setLocationLoading(false);
    }
  };

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

  const handleNavigate = (spot: Spot) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`;
    Linking.openURL(url).catch((err) =>
      console.error('Error opening maps:', err)
    );
  };

  const handleInviteMore = () => {
    const inviteLink = `https://midpoint.app/invite/SESSION123`;
    Alert.alert(
      'Invite More People',
      `Share this link:\n\n${inviteLink}`,
      [
        { text: 'Copy Link', onPress: () => console.log('Link copied') },
        { text: 'Close' },
      ]
    );
  };

  const allUsersHaveLocation = participants.every((p) => p.user_lat !== null && p.user_lng !== null);

  const renderParticipant = ({ item, index }: { item: Participant; index: number }) => (
    <React.Fragment key={item.id}>
      <View style={styles.participantItem}>
        <View style={[styles.participantAvatar, { backgroundColor: colors.primary }]}>
          <MaterialIcons name="person" size={24} color={colors.card} />
        </View>
        <View style={styles.participantInfo}>
          <Text style={[styles.participantName, { color: colors.text }]}>
            {item.user_name}
            {item.isCurrentUser && ' (You)'}
          </Text>
          {item.isCurrentUser && locationLoading && (
            <Text style={[styles.participantStatus, { color: colors.textSecondary }]}>
              Getting location...
            </Text>
          )}
          {item.isCurrentUser && locationError && (
            <Text style={[styles.participantStatus, { color: colors.error }]}>
              {locationError}
            </Text>
          )}
        </View>
        {item.user_lat !== null && item.user_lng !== null ? (
          <MaterialIcons name="location-on" size={20} color={colors.success} />
        ) : (
          <MaterialIcons name="location-off" size={20} color={colors.error} />
        )}
      </View>
      {index < participants.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
    </React.Fragment>
  );

  const renderSpot = ({ item, index }: { item: Spot; index: number }) => (
    <React.Fragment key={item.id}>
      <View style={styles.spotItem}>
        <View style={[styles.spotIcon, { backgroundColor: colors.background }]}>
          <MaterialIcons name="place" size={24} color={colors.secondary} />
        </View>
        <View style={styles.spotInfo}>
          <Text style={[styles.spotName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.spotCategory, { color: colors.primary }]}>{item.category}</Text>
          {item.address && (
            <Text style={[styles.spotAddress, { color: colors.text }]} numberOfLines={1}>
              {item.address}
            </Text>
          )}
          <Text style={[styles.spotCoordinates, { color: colors.textSecondary }]}>
            {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
          </Text>
          <Text style={[styles.spotDistance, { color: colors.textSecondary }]}>
            {item.distance?.toFixed(2)} km from midpoint
          </Text>
        </View>
        <TouchableOpacity
          style={styles.navigateButton}
          onPress={() => handleNavigate(item)}
        >
          <MaterialIcons name="navigation" size={32} color={colors.accent} />
        </TouchableOpacity>
      </View>
      {index < spotsWithDistance.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
    </React.Fragment>
  );

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
            <Text style={[styles.sessionTitle, { color: colors.text }]}>{sessionTitle}</Text>
            <Text style={[styles.sessionCategory, { color: colors.primary }]}>{sessionCategory}</Text>
          </View>
        </View>

        {isSafeMode && (
          <View style={[styles.safeModeIndicator, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
            <Text style={[styles.safeModeText, { color: colors.success }]}>
              🔒 Safe Meet Mode Active
            </Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Participants</Text>
          <FlatList
            data={participants}
            renderItem={renderParticipant}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
          
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
                {midpointAddress && (
                  <Text style={[styles.addressText, { color: colors.text }]}>
                    {midpointAddress}
                  </Text>
                )}
                <Text style={[styles.coordinatesText, { color: colors.textSecondary }]}>
                  {midpoint.latitude.toFixed(4)}, {midpoint.longitude.toFixed(4)}
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
            <FlatList
              data={spotsWithDistance}
              renderItem={renderSpot}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
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
  safeModeIndicator: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
    alignItems: 'center',
  },
  safeModeText: {
    fontSize: 14,
    fontWeight: '700',
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
    marginBottom: 8,
  },
  addressText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  coordinatesText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
    marginBottom: 4,
  },
  spotAddress: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  spotCoordinates: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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


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
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, useThemeColors } from '@/styles/commonStyles';
import { mockSessions, mockCurrentUser } from '@/data/mockData';

export default function HomeScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const colorScheme = useColorScheme();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
        console.log('Location obtained:', currentLocation.coords);
      } else {
        console.log('Location permission denied');
        Alert.alert(
          'Permission Required',
          'Location permission is needed to calculate meeting points.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.log('Error requesting location permission:', error);
    }
  };

  const handleCreateSession = () => {
    if (!hasPermission) {
      Alert.alert(
        'Location Required',
        'Please enable location services to create a session.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', onPress: requestLocationPermission },
        ]
      );
      return;
    }
    router.push('/create-session');
  };

  const handleInviteFriends = () => {
    const inviteLink = 'https://midpoint.app/invite/DEMO123';
    Alert.alert(
      'Invite Friends',
      `Share this link with your friends:\n\n${inviteLink}`,
      [
        { text: 'Copy Link', onPress: () => console.log('Link copied') },
        { text: 'Close' },
      ]
    );
  };

  const recentSessions = mockSessions.filter((s) => s.creator_id === mockCurrentUser.id);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'android' && { paddingTop: 48 },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text }]}>Welcome to MidPoint</Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            Meet halfway without sharing your home address
          </Text>
        </View>

        <View style={[styles.locationCard, { backgroundColor: themeColors.card }]}>
          <View style={styles.locationHeader}>
            <IconSymbol
              ios_icon_name="location.fill"
              android_material_icon_name="location-on"
              size={24}
              color={colors.primary}
            />
            <Text style={[styles.locationTitle, { color: themeColors.text }]}>Your Location</Text>
          </View>
          {location ? (
            <Text style={[styles.locationText, { color: themeColors.textSecondary }]}>
              {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
            </Text>
          ) : (
            <Text style={[styles.locationText, { color: themeColors.textSecondary }]}>
              {hasPermission ? 'Getting location...' : 'Location not available'}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, styles.createButton]}
          onPress={handleCreateSession}
        >
          <IconSymbol
            ios_icon_name="plus.circle.fill"
            android_material_icon_name="add-circle"
            size={24}
            color="#FFFFFF"
          />
          <Text style={[styles.buttonText, styles.buttonTextWithIcon]}>
            Start a New MidPoint
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.outlineButton, styles.inviteButton]}
          onPress={handleInviteFriends}
        >
          <IconSymbol
            ios_icon_name="person.2.fill"
            android_material_icon_name="group"
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.outlineButtonText, styles.buttonTextWithIcon]}>
            Invite Friends
          </Text>
        </TouchableOpacity>

        <View style={styles.sessionsSection}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Your Past Sessions</Text>
          {recentSessions.length > 0 ? (
            recentSessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={[styles.card, { backgroundColor: themeColors.card }]}
                onPress={() => router.push(`/session/${session.id}`)}
              >
                <View style={styles.sessionCard}>
                  <View style={[styles.sessionIcon, { backgroundColor: themeColors.background }]}>
                    <IconSymbol
                      ios_icon_name="mappin.circle.fill"
                      android_material_icon_name="place"
                      size={32}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.sessionInfo}>
                    <Text style={[styles.sessionTitle, { color: themeColors.text }]}>{session.title}</Text>
                    <Text style={styles.sessionCategory}>{session.category}</Text>
                    <Text style={[styles.sessionDate, { color: themeColors.textSecondary }]}>
                      {new Date(session.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      session.status === 'active'
                        ? styles.statusActive
                        : styles.statusCompleted,
                    ]}
                  >
                    <Text style={styles.statusText}>{session.status}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="tray.fill"
                android_material_icon_name="inbox"
                size={48}
                color={themeColors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: themeColors.text }]}>No sessions yet</Text>
              <Text style={[styles.emptySubtext, { color: themeColors.textSecondary }]}>
                Create your first MidPoint session to get started
              </Text>
            </View>
          )}
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
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  locationCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationText: {
    fontSize: 14,
    marginLeft: 32,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  outlineButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  inviteButton: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  buttonTextWithIcon: {
    marginLeft: 0,
  },
  sessionsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sessionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sessionCategory: {
    fontSize: 14,
    color: colors.primary,
    marginBottom: 2,
  },
  sessionDate: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: colors.success,
  },
  statusCompleted: {
    backgroundColor: colors.textSecondary,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});

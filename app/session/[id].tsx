
import React, { useState } from 'react';
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
import { IconSymbol } from '@/components/IconSymbol';
import { colors, useThemeColors } from '@/styles/commonStyles';
import { mockSessions, mockParticipants, mockSpots } from '@/data/mockData';
import { calculateMidpoint } from '@/utils/locationUtils';

export default function SessionScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const { id } = useLocalSearchParams();
  const [refreshing, setRefreshing] = useState(false);

  const session = mockSessions.find((s) => s.id === id);
  const participants = mockParticipants.filter((p) => p.session_id === id);
  const spots = mockSpots.filter((s) => s.session_id === id);

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>Session not found</Text>
      </View>
    );
  }

  const midpoint = calculateMidpoint(participants);

  const handleRefreshMidpoint = () => {
    setRefreshing(true);
    console.log('Refreshing midpoint...');
    setTimeout(() => {
      setRefreshing(false);
      Alert.alert('Success', 'Midpoint refreshed!');
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
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: themeColors.card }]}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="chevron-left"
              size={24}
              color={themeColors.text}
            />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.sessionTitle, { color: themeColors.text }]}>{session.title}</Text>
            <Text style={styles.sessionCategory}>{session.category}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.cardTitle, { color: themeColors.text }]}>Participants</Text>
          {participants.map((participant, index) => (
            <React.Fragment key={participant.id}>
              <View style={styles.participantItem}>
                <View style={styles.participantAvatar}>
                  <IconSymbol
                    ios_icon_name="person.fill"
                    android_material_icon_name="person"
                    size={24}
                    color={colors.card}
                  />
                </View>
                <Text style={[styles.participantName, { color: themeColors.text }]}>{participant.user_name}</Text>
                {participant.user_lat && participant.user_lng && (
                  <IconSymbol
                    ios_icon_name="location.fill"
                    android_material_icon_name="location-on"
                    size={20}
                    color={colors.success}
                  />
                )}
              </View>
              {index < participants.length - 1 && <View style={[styles.divider, { backgroundColor: themeColors.border }]} />}
            </React.Fragment>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: themeColors.card }]}>
          <View style={styles.midpointHeader}>
            <Text style={[styles.cardTitle, { color: themeColors.text }]}>Midpoint Location</Text>
            <TouchableOpacity
              onPress={handleRefreshMidpoint}
              disabled={refreshing}
              style={styles.refreshButton}
            >
              <IconSymbol
                ios_icon_name="arrow.clockwise"
                android_material_icon_name="refresh"
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
          {midpoint ? (
            <View style={[styles.mapPlaceholder, { backgroundColor: themeColors.background }]}>
              <IconSymbol
                ios_icon_name="map.fill"
                android_material_icon_name="map"
                size={48}
                color={colors.primary}
              />
              <Text style={[styles.mapText, { color: themeColors.textSecondary }]}>
                Note: react-native-maps is not supported in Natively.
              </Text>
              <Text style={[styles.coordinatesText, { color: themeColors.text }]}>
                Midpoint: {midpoint.latitude.toFixed(4)}, {midpoint.longitude.toFixed(4)}
              </Text>
            </View>
          ) : (
            <Text style={[styles.noMidpointText, { color: themeColors.textSecondary }]}>
              Waiting for participant locations...
            </Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.cardTitle, { color: themeColors.text }]}>Recommended Meeting Spots</Text>
          {spots.length > 0 ? (
            spots.map((spot, index) => (
              <React.Fragment key={spot.id}>
                <View style={styles.spotItem}>
                  <View style={[styles.spotIcon, { backgroundColor: themeColors.background }]}>
                    <IconSymbol
                      ios_icon_name="mappin.circle.fill"
                      android_material_icon_name="place"
                      size={24}
                      color={colors.secondary}
                    />
                  </View>
                  <View style={styles.spotInfo}>
                    <Text style={[styles.spotName, { color: themeColors.text }]}>{spot.name}</Text>
                    <Text style={styles.spotCategory}>{spot.category}</Text>
                    {spot.address && (
                      <Text style={[styles.spotAddress, { color: themeColors.textSecondary }]}>{spot.address}</Text>
                    )}
                    {spot.distance && (
                      <Text style={[styles.spotDistance, { color: themeColors.textSecondary }]}>{spot.distance} km away</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.navigateButton}
                    onPress={() => handleNavigate(spot)}
                  >
                    <IconSymbol
                      ios_icon_name="arrow.right.circle.fill"
                      android_material_icon_name="navigation"
                      size={32}
                      color={colors.accent}
                    />
                  </TouchableOpacity>
                </View>
                {index < spots.length - 1 && <View style={[styles.divider, { backgroundColor: themeColors.border }]} />}
              </React.Fragment>
            ))
          ) : (
            <Text style={[styles.noSpotsText, { color: themeColors.textSecondary }]}>
              No spots found. Try refreshing the midpoint.
            </Text>
          )}
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.outlineButton, styles.actionButton]}
            onPress={handleInviteMore}
          >
            <IconSymbol
              ios_icon_name="person.badge.plus"
              android_material_icon_name="person-add"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.outlineButtonText, styles.actionButtonText]}>
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
    color: colors.primary,
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantName: {
    flex: 1,
    fontSize: 16,
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
    color: colors.primary,
    marginBottom: 2,
  },
  spotAddress: {
    fontSize: 12,
    marginBottom: 2,
  },
  spotDistance: {
    fontSize: 12,
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
    borderColor: colors.primary,
  },
  outlineButtonText: {
    color: colors.primary,
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

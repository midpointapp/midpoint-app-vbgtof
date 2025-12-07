
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, useThemeColors } from '@/styles/commonStyles';
import { mockSessions, mockCurrentUser } from '@/data/mockData';

export default function SessionsScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();

  const activeSessions = mockSessions.filter((s) => s.status === 'active');
  const completedSessions = mockSessions.filter((s) => s.status === 'completed');

  const renderSessionCard = (session: any) => (
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
        <IconSymbol
          ios_icon_name="chevron.right"
          android_material_icon_name="chevron-right"
          size={24}
          color={themeColors.textSecondary}
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'android' && { paddingTop: 48 },
        ]}
      >
        <Text style={[styles.title, { color: themeColors.text }]}>Sessions</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>View all your meeting sessions</Text>

        {activeSessions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Active Sessions</Text>
            {activeSessions.map(renderSessionCard)}
          </View>
        )}

        {completedSessions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Completed Sessions</Text>
            {completedSessions.map(renderSessionCard)}
          </View>
        )}

        {activeSessions.length === 0 && completedSessions.length === 0 && (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="tray.fill"
              android_material_icon_name="inbox"
              size={64}
              color={themeColors.textSecondary}
            />
            <Text style={[styles.emptyText, { color: themeColors.text }]}>No sessions yet</Text>
            <Text style={[styles.emptySubtext, { color: themeColors.textSecondary }]}>
              Create your first MidPoint session from the Home tab
            </Text>
          </View>
        )}
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
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

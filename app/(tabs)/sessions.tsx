
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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const mockSessions = [
  {
    id: '1',
    title: 'Coffee with Sarah',
    category: 'Coffee',
    status: 'active',
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    title: 'Lunch with Team',
    category: 'Meal',
    status: 'completed',
    created_at: '2024-01-10T12:00:00Z',
  },
];

export default function SessionsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const colors = {
    background: isDark ? '#121212' : '#F5F5F5',
    text: isDark ? '#FFFFFF' : '#212121',
    textSecondary: isDark ? '#B0B0B0' : '#757575',
    primary: '#3F51B5',
    card: isDark ? '#212121' : '#FFFFFF',
    border: isDark ? '#424242' : '#E0E0E0',
  };

  const activeSessions = mockSessions.filter((s) => s.status === 'active');
  const completedSessions = mockSessions.filter((s) => s.status === 'completed');

  const renderSessionCard = (session: any) => (
    <TouchableOpacity
      key={session.id}
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => router.push(`/session/${session.id}` as any)}
    >
      <View style={styles.sessionCard}>
        <View style={[styles.sessionIcon, { backgroundColor: colors.background }]}>
          <MaterialIcons name="place" size={32} color={colors.primary} />
        </View>
        <View style={styles.sessionInfo}>
          <Text style={[styles.sessionTitle, { color: colors.text }]}>{session.title}</Text>
          <Text style={[styles.sessionCategory, { color: colors.primary }]}>{session.category}</Text>
          <Text style={[styles.sessionDate, { color: colors.textSecondary }]}>
            {new Date(session.created_at).toLocaleDateString()}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
      </View>
    </TouchableOpacity>
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
        <Text style={[styles.title, { color: colors.text }]}>Sessions</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>View all your meeting sessions</Text>

        {activeSessions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Sessions</Text>
            {activeSessions.map(renderSessionCard)}
          </View>
        )}

        {completedSessions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Completed Sessions</Text>
            {completedSessions.map(renderSessionCard)}
          </View>
        )}

        {activeSessions.length === 0 && completedSessions.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="inbox" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No sessions yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
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

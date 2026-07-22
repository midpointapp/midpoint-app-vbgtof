
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useThemeColors } from '@/styles/commonStyles';
import { supabase } from '@/app/integrations/supabase/client';

interface Session {
  id: string;
  title: string;
  category: string;
  status: 'active' | 'completed';
  created_at: string;
}

const CATEGORY_MAP: Record<string, string> = {
  coffee: '☕ Coffee',
  food: '🍔 Food',
  marketplace: '🛍️ Marketplace',
  gas: '⛽ Gas Station',
  park: '🌳 Park',
  police: '🚔 Police Station',
};

function getCategoryLabel(type: string): string {
  return CATEGORY_MAP[type] ?? type;
}

function getTitleFromType(type: string): string {
  const label = getCategoryLabel(type);
  return `${label} Meet`;
}

export default function SessionsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    console.log('[Sessions] Fetching sessions from Supabase');
    try {
      const { data, error } = await supabase
        .from('meet_sessions')
        .select('id, type, status, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.log('[Sessions] Fetch error:', error.message);
        return;
      }

      const mapped: Session[] = (data || []).map((row: any) => ({
        id: row.id,
        title: getTitleFromType(row.type),
        category: getCategoryLabel(row.type),
        status: row.status === 'confirmed' ? 'completed' : 'active',
        created_at: row.created_at,
      }));

      console.log('[Sessions] Loaded', mapped.length, 'sessions');
      setSessions(mapped);
    } finally {
      setLoading(false);
    }
  };

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  const renderSessionCard = ({ item }: { item: Session }) => {
    const dateDisplay = new Date(item.created_at).toLocaleDateString();
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={() => {
          console.log('[Sessions] Tapped session:', item.id);
          router.push(`/session?sessionId=${item.id}&isSender=true` as any);
        }}
      >
        <View style={styles.sessionCard}>
          <View style={[styles.sessionIcon, { backgroundColor: colors.background }]}>
            <MaterialIcons name="place" size={32} color={colors.primary} />
          </View>
          <View style={styles.sessionInfo}>
            <Text style={[styles.sessionTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.sessionCategory, { color: colors.primary }]}>{item.category}</Text>
            <Text style={[styles.sessionDate, { color: colors.textSecondary }]}>{dateDisplay}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="inbox" size={64} color={colors.textSecondary} />
      <Text style={[styles.emptyText, { color: colors.text }]}>No sessions yet</Text>
      <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
        Create your first MidPoint session from the Home tab
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View>
      <Text style={[styles.title, { color: colors.text }]}>Sessions</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        View all your meeting sessions
      </Text>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading sessions...</Text>
        </View>
      )}

      {activeSessions.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Sessions</Text>
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (completedSessions.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Completed Sessions</Text>
        <FlatList
          data={completedSessions}
          renderItem={renderSessionCard}
          keyExtractor={(item) => `completed-${item.id}`}
          scrollEnabled={false}
        />
      </View>
    );
  };

  const showEmpty = !loading && sessions.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={activeSessions}
        renderItem={renderSessionCard}
        keyExtractor={(item) => `active-${item.id}`}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={showEmpty ? renderEmptyState : null}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'android' && { paddingTop: 48 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
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

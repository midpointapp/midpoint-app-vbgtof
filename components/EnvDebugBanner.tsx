import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '(not set)';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '(not set)';
const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '(not set)';

export function EnvDebugBanner() {
  const supabaseOk = SUPABASE_URL.includes('supabase.co');
  const anonOk = ANON_KEY.length > 20;
  const placesOk = PLACES_KEY.startsWith('AIza');

  const allOk = supabaseOk && anonOk && placesOk;

  const bannerBg = allOk ? '#166534' : '#7f1d1d';
  const anonDisplay = anonOk ? ANON_KEY.slice(0, 12) + '…' : 'MISSING';
  const placesDisplay = placesOk ? PLACES_KEY.slice(0, 12) + '…' : 'MISSING';
  const supabaseDisplay = SUPABASE_URL.slice(0, 30);
  const supabaseStatus = supabaseOk ? '✅' : '❌';
  const anonStatus = anonOk ? '✅' : '❌';
  const placesStatus = placesOk ? '✅' : '❌';
  const overallStatus = allOk ? '✅' : '❌';
  const platformName = Platform.OS;

  return (
    <View style={[styles.banner, { backgroundColor: bannerBg }]}>
      <Text style={styles.title}>
        🔧 Env Check
      </Text>
      <Text style={styles.title}>
        {overallStatus}
      </Text>
      <Text style={styles.row}>
        Supabase URL:
      </Text>
      <Text style={styles.row}>
        {supabaseStatus}
      </Text>
      <Text style={styles.row}>
        {supabaseDisplay}
      </Text>
      <Text style={styles.row}>
        Anon Key:
      </Text>
      <Text style={styles.row}>
        {anonStatus}
      </Text>
      <Text style={styles.row}>
        {anonDisplay}
      </Text>
      <Text style={styles.row}>
        Places Key:
      </Text>
      <Text style={styles.row}>
        {placesStatus}
      </Text>
      <Text style={styles.row}>
        {placesDisplay}
      </Text>
      <Text style={styles.row}>
        Platform:
      </Text>
      <Text style={styles.row}>
        {platformName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: 10,
    paddingTop: 48,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  title: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 4,
  },
  row: {
    color: '#d1fae5',
    fontSize: 11,
    fontFamily: 'monospace',
  },
});

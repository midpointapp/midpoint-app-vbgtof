
import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter, useLocalSearchParams, Redirect } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';

/**
 * Root landing page (app/index.tsx)
 * 
 * CRITICAL FIX: Safe fallback for deep links
 * If user opens /?sessionId=...&token=..., immediately redirect to /session
 * This avoids server 404s even if SPA rewrites fail
 */
export default function IndexScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();

  // Parse params - handle both string and array cases
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const meetPointId = Array.isArray(params.meetPointId) ? params.meetPointId[0] : params.meetPointId;

  console.log('[Index] ========== ROOT INDEX SCREEN ==========');
  console.log('[Index] Query params:', { sessionId, token, meetPointId });

  useEffect(() => {
    // CRITICAL FIX: If sessionId present, redirect to /session immediately
    if (sessionId) {
      console.log('[Index] ✅ sessionId found - redirecting to /session');
      console.log('[Index] sessionId:', sessionId);
      console.log('[Index] token:', token);
      
      // Use router.replace to avoid back button issues
      if (token) {
        router.replace({ pathname: '/session', params: { sessionId, token } });
      } else {
        router.replace({ pathname: '/session', params: { sessionId } });
      }
      return;
    }

    // Handle legacy meetPointId
    if (meetPointId) {
      console.log('[Index] ✅ meetPointId found - redirecting to /meet-now');
      router.replace({ pathname: '/meet-now', params: { meetPointId } });
      return;
    }

    // No deep link params - redirect to home
    console.log('[Index] No deep link params - redirecting to home');
    router.replace('/(tabs)/(home)/');
  }, [sessionId, token, meetPointId]);

  // Show loading state while redirecting
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ marginTop: 16, fontSize: 16, color: colors.text }}>
        Loading...
      </Text>
    </View>
  );
}

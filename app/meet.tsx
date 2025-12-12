
import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams, Redirect } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';

/**
 * Fallback redirect handler for /meet route
 * Redirects to /meet-now with any query parameters
 */
export default function MeetRedirect() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();

  // Check if there's a meetPointId parameter
  const meetPointId = params?.meetPointId as string | undefined;

  console.log('[MeetRedirect] Redirecting /meet to /meet-now', { meetPointId });

  // If there's a meetPointId, redirect to /meet-now with it
  if (meetPointId) {
    return <Redirect href={`/meet-now?meetPointId=${meetPointId}`} />;
  }

  // Otherwise, just redirect to /meet-now
  return <Redirect href="/meet-now" />;
}

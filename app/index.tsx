
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function IndexScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
    const token = Array.isArray(params.token) ? params.token[0] : params.token;
    const meetPointId = Array.isArray(params.meetPointId) ? params.meetPointId[0] : params.meetPointId;

    console.log('[Index] params on mount:', { sessionId, token, meetPointId });

    if (sessionId) {
      console.log('[Index] sessionId found — navigating to /session');
      router.replace({
        pathname: '/session',
        params: { sessionId, ...(token ? { token } : {}) },
      });
      return;
    }

    if (meetPointId) {
      console.log('[Index] meetPointId found — navigating to /meet-now');
      router.replace({ pathname: '/meet-now', params: { meetPointId } });
      return;
    }

    // No params — go to home tabs
    console.log('[Index] no params — going to home');
    router.replace('/(tabs)/(home)/');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

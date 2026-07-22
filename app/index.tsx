import React, { useEffect } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';

function getWebParams(): { sessionId?: string; token?: string; meetPointId?: string } {
  if (typeof window === 'undefined') return {};
  const search = window.location.search;
  const urlParams = new URLSearchParams(search);
  return {
    sessionId: urlParams.get('sessionId') ?? undefined,
    token: urlParams.get('token') ?? undefined,
    meetPointId: urlParams.get('meetPointId') ?? undefined,
  };
}

export default function IndexScreen() {
  // On web: read directly from window.location.search — always available, no router parsing delay
  if (Platform.OS === 'web') {
    const { sessionId, token, meetPointId } = getWebParams();
    console.log('[Index] web params from window.location.search:', { sessionId, token, meetPointId });

    if (sessionId) {
      console.log('[Index] web: sessionId found — redirecting to /session');
      return (
        <Redirect
          href={{
            pathname: '/session',
            params: { sessionId, ...(token ? { token } : {}) },
          }}
        />
      );
    }
    if (meetPointId) {
      console.log('[Index] web: meetPointId found — redirecting to /meet-now');
      return <Redirect href={{ pathname: '/meet-now', params: { meetPointId } }} />;
    }
    console.log('[Index] web: no params — redirecting to home');
    return <Redirect href="/(tabs)/(home)/" />;
  }

  // On native: useLocalSearchParams is reliable after mount
  return <NativeIndexScreen />;
}

function NativeIndexScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const meetPointId = Array.isArray(params.meetPointId) ? params.meetPointId[0] : params.meetPointId;

  console.log('[Index] native params:', { sessionId, token, meetPointId });

  useEffect(() => {
    if (sessionId) {
      console.log('[Index] native: sessionId found — navigating to /session');
      router.replace({
        pathname: '/session',
        params: { sessionId, ...(token ? { token } : {}) },
      });
      return;
    }
    if (meetPointId) {
      console.log('[Index] native: meetPointId found — navigating to /meet-now');
      router.replace({ pathname: '/meet-now', params: { meetPointId } });
      return;
    }
    console.log('[Index] native: no params — going to home');
    router.replace('/(tabs)/(home)/');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token, meetPointId]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

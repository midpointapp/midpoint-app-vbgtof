import { Redirect, useLocalSearchParams } from 'expo-router';

export default function IndexScreen() {
  console.log('[IndexScreen] Mounted, checking deep link params');
  const params = useLocalSearchParams<{ sessionId?: string; token?: string }>();

  if (params.sessionId && params.token) {
    console.log('[IndexScreen] Deep link params found, redirecting to session', {
      sessionId: params.sessionId,
      token: params.token,
    });
    const sessionId = encodeURIComponent(params.sessionId);
    const token = encodeURIComponent(params.token);
    return <Redirect href={`/session?sessionId=${sessionId}&token=${token}`} />;
  }

  console.log('[IndexScreen] No deep link params, redirecting to home');
  return <Redirect href="/(tabs)/(home)/" />;
}

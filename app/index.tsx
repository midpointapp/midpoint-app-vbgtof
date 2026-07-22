
import React from 'react';
import { useLocalSearchParams, Redirect } from 'expo-router';

export default function IndexScreen() {
  const params = useLocalSearchParams();

  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const meetPointId = Array.isArray(params.meetPointId) ? params.meetPointId[0] : params.meetPointId;

  console.log('[Index] params:', { sessionId, token, meetPointId });

  // Deep link: /?sessionId=X&token=Y  →  /session?sessionId=X&token=Y
  if (sessionId) {
    console.log('[Index] redirecting to /session');
    return <Redirect href={{ pathname: '/session', params: { sessionId, ...(token ? { token } : {}) } }} />;
  }

  // Legacy deep link: /?meetPointId=X
  if (meetPointId) {
    console.log('[Index] redirecting to /meet-now');
    return <Redirect href={{ pathname: '/meet-now', params: { meetPointId } }} />;
  }

  // No deep link params — go to home tabs
  console.log('[Index] no params, redirecting to home');
  return <Redirect href="/(tabs)/(home)/" />;
}

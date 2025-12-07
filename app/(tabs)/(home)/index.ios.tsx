
import React from 'react';
import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 12 }}>MidPoint</Text>
      <Text style={{ textAlign: 'center', marginBottom: 24 }}>
        Instantly find the halfway point between you and someone else.
      </Text>
      <Button title="Find the Midpoint" onPress={() => router.push('/meet-now')} />
    </View>
  );
}

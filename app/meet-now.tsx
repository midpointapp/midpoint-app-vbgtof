
import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { useRouter } from 'expo-router';

export default function MeetNowScreen() {
  const router = useRouter();
  const [person, setPerson] = useState('');
  const [type, setType] = useState('');

  const handleFind = () => {
    console.log('Find midpoint with:', { person, type });
    router.back();
  };

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 24 }}>Meet in the Middle</Text>

      <Text>Who are you meeting?</Text>
      <TextInput
        style={{ borderWidth: 1, marginBottom: 12, padding: 8 }}
        placeholder="Ex: Mom, Sarah, Chris"
        value={person}
        onChangeText={setPerson}
      />

      <Text>Type of meetup</Text>
      <TextInput
        style={{ borderWidth: 1, marginBottom: 12, padding: 8 }}
        placeholder="Ex: Coffee, Meal, Marketplace Sale"
        value={type}
        onChangeText={setType}
      />

      <Button title="Find Midpoint" onPress={handleFind} />
    </View>
  );
}

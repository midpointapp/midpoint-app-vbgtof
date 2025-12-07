
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';

export default function CreateSessionScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const colors = {
    background: isDark ? '#121212' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#212121',
    textSecondary: isDark ? '#B0B0B0' : '#757575',
    primary: '#3F51B5',
    border: isDark ? '#424242' : '#E0E0E0',
  };

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');

  const handleCreate = () => {
    console.log('Creating session:', { title, category });
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>New MidPoint Session</Text>

      <Text style={[styles.label, { color: colors.text }]}>Title</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        placeholder="Ex: Meet halfway with Mom"
        placeholderTextColor={colors.textSecondary}
        value={title}
        onChangeText={setTitle}
      />

      <Text style={[styles.label, { color: colors.text }]}>Category</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        placeholder="Ex: Coffee, Meal, Marketplace, Gas"
        placeholderTextColor={colors.textSecondary}
        value={category}
        onChangeText={setCategory}
      />

      <Pressable style={[styles.button, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={handleCreate}>
        <Text style={styles.buttonText}>Create MidPoint</Text>
      </Pressable>

      <Pressable style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => router.back()}>
        <Text style={[styles.secondaryText, { color: colors.text }]}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    borderWidth: 1,
    marginTop: 6,
  },
  button: {
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

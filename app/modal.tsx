import { StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { GlassView } from 'expo-glass-effect';
import { useThemeColors } from '@/styles/commonStyles';

export default function Modal() {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Standard Modal</Text>
      <Text style={[styles.text, { color: colors.text }]}>This is a modal presentation.</Text>

      <Pressable onPress={() => router.back()}>
        <GlassView style={styles.button} glassEffectStyle="clear">
          <Text style={[styles.buttonText, { color: colors.primary }]}>Close Modal</Text>
        </GlassView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    // backgroundColor handled dynamically
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    // color handled dynamically
  },
  text: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    // color handled dynamically
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    // color handled dynamically
  },
});

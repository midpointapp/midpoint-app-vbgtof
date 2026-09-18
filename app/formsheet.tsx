import { StyleSheet, Text, View, Pressable, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { GlassView } from 'expo-glass-effect';
import { useThemeColors } from '@/styles/commonStyles';

export default function FormSheetModal() {
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';

  // Use a visible dark gray for dark mode instead of pure black
  const backgroundColor = isDark
    ? 'rgb(28, 28, 30)' // Dark gray that's visible against black backgrounds
    : colors.background;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={[styles.title, { color: colors.text }]}>Form Sheet Modal</Text>
      <Text style={[styles.text, { color: colors.text }]}>Drag the grabber to resize!</Text>

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

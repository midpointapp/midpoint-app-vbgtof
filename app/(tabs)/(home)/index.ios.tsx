
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/app/integrations/supabase/client';

export default function HomeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const handleFindMidpoint = () => {
    console.log('[Home] Find the Midpoint button pressed');
    router.push('/meet-now');
  };

  const handleSafeMeet = () => {
    console.log('[Home] Safe Meet button pressed');
    router.push({ pathname: '/meet-now', params: { safeMode: 'true' } });
  };

  const handleJoinSession = async () => {
    const code = joinCode.trim().toUpperCase();
    console.log('[Home] Join a Meet button pressed, code:', code);

    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-character join code.');
      return;
    }

    setJoining(true);
    console.log('[Home] Looking up session by join code:', code);

    try {
      const { data, error } = await supabase
        .from('meet_sessions')
        .select('*')
        .eq('join_code', code)
        .single();

      if (error || !data) {
        console.log('[Home] Join code not found:', code, error?.message);
        Alert.alert('Code Not Found', 'Check the code and try again.');
        return;
      }

      console.log('[Home] Session found for join code:', code, 'session id:', data.id);

      if (new Date(data.expires_at) < new Date()) {
        console.log('[Home] Session expired:', data.expires_at);
        Alert.alert('Session Expired', 'This session has expired.');
        return;
      }

      console.log('[Home] Navigating to session as receiver, id:', data.id);
      router.push(`/session?sessionId=${data.id}&token=${data.invite_token}`);
    } catch (err: any) {
      console.error('[Home] Error looking up join code:', err.message);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const joinCodeDisplay = joinCode.toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primary + '20', colors.background]}
        style={styles.gradientBackground}
      />
      
      <View style={styles.content}>
        <View style={styles.headerContainer}>
          <Text style={[styles.title, { color: colors.text }]}>MidPoint</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Meet in the middle.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleFindMidpoint}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Find the Midpoint</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.primary }]}
            onPress={handleSafeMeet}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
              Safe Meet
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <View style={[styles.joinCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.joinTitle, { color: colors.text }]}>Join a Meet</Text>
          <Text style={[styles.joinSubtitle, { color: colors.textSecondary }]}>
            Enter the 6-character code from your friend
          </Text>
          <TextInput
            style={[styles.codeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            value={joinCodeDisplay}
            onChangeText={(text) => {
              console.log('[Home] Join code input changed:', text.toUpperCase());
              setJoinCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
            }}
            placeholder="A1B2C3"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            maxLength={6}
            autoCorrect={false}
            keyboardType="default"
          />
          <TouchableOpacity
            style={[styles.joinButton, { backgroundColor: joining ? colors.border : colors.primary }, joining && styles.joinButtonDisabled]}
            onPress={handleJoinSession}
            activeOpacity={0.8}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.joinButtonText}>Join</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Instantly find the halfway point between you and someone else.
          </Text>
          <Text style={[styles.infoTextSmall, { color: colors.textSecondary }]}>
            Safe Meet hides your exact location for privacy.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
    marginBottom: 24,
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    marginBottom: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  joinCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  joinTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  joinSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  codeInput: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 10,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  joinButton: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  infoContainer: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  infoText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  infoTextSmall: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
});

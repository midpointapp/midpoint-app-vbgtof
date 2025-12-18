
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import { LinearGradient } from 'expo-linear-gradient';

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const [isRedirecting, setIsRedirecting] = React.useState(false);

  // Auto-route to Session flow if sessionId + token are present in URL
  // Auto-route to Meet Now flow if meetPointId is present in URL
  useEffect(() => {
    console.log('[Home] Checking URL params for auto-routing...');
    console.log('[Home] All params:', JSON.stringify(params, null, 2));
    
    // Check for sessionId + token first (new flow)
    if (params?.sessionId) {
      const sessionId = Array.isArray(params.sessionId) 
        ? params.sessionId[0] 
        : params.sessionId;
      const token = params?.token 
        ? (Array.isArray(params.token) ? params.token[0] : params.token)
        : null;
      
      console.log('[Home] sessionId detected from params:', sessionId);
      console.log('[Home] token detected from params:', token);
      console.log('[Home] Navigation target: /session');
      setIsRedirecting(true);
      
      if (token) {
        router.replace(`/session?sessionId=${sessionId}&token=${token}`);
      } else {
        router.replace(`/session?sessionId=${sessionId}`);
      }
      return;
    }

    // Check URL params from expo-router for meetPointId (legacy flow)
    if (params?.meetPointId) {
      const meetPointId = Array.isArray(params.meetPointId) 
        ? params.meetPointId[0] 
        : params.meetPointId;
      
      console.log('[Home] meetPointId detected from params:', meetPointId);
      console.log('[Home] Navigation target: /meet-now');
      setIsRedirecting(true);
      router.replace(`/meet-now?meetPointId=${meetPointId}`);
      return;
    }

    // On web, also check window.location.search
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        console.log('[Home] Checking window.location.search:', window.location.search);
        
        // Check for sessionId + token (new flow)
        const sessionId = urlParams.get('sessionId');
        const token = urlParams.get('token');
        if (sessionId) {
          console.log('[Home] sessionId detected from window.location:', sessionId);
          console.log('[Home] token detected from window.location:', token);
          console.log('[Home] Navigation target: /session');
          setIsRedirecting(true);
          
          if (token) {
            router.replace(`/session?sessionId=${sessionId}&token=${token}`);
          } else {
            router.replace(`/session?sessionId=${sessionId}`);
          }
          return;
        }

        // Check for meetPointId (legacy flow)
        const meetPointId = urlParams.get('meetPointId');
        if (meetPointId) {
          console.log('[Home] meetPointId detected from window.location:', meetPointId);
          console.log('[Home] Navigation target: /meet-now');
          setIsRedirecting(true);
          router.replace(`/meet-now?meetPointId=${meetPointId}`);
          return;
        }
      } catch (error) {
        console.error('[Home] Error parsing URL:', error);
      }
    }
    
    console.log('[Home] No auto-routing params found, showing normal home UI');
  }, [params, router]);

  // Show loading view while redirecting
  if (isRedirecting) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading session...
        </Text>
      </View>
    );
  }

  const handleMeetNow = () => {
    router.push('/meet-now');
  };

  const handleSafeMeet = () => {
    router.push({ pathname: '/meet-now', params: { safeMode: 'true' } });
  };

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
            onPress={handleMeetNow}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Meet Now</Text>
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
    marginBottom: 60,
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
    marginBottom: 40,
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 4px 12px rgba(63, 81, 181, 0.3)',
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
});

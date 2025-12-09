
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_STORAGE_KEY = '@midpoint_user';

export default function OnboardingScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const colors = {
    background: isDark ? '#121212' : '#F5F5F5',
    text: isDark ? '#FFFFFF' : '#212121',
    textSecondary: isDark ? '#B0B0B0' : '#757575',
    primary: '#3F51B5',
    card: isDark ? '#212121' : '#FFFFFF',
    border: isDark ? '#424242' : '#E0E0E0',
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [homeArea, setHomeArea] = useState('');

  const saveUserData = async (userData: any) => {
    try {
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      console.log('User data saved:', userData);
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    console.log('Logging in with email:', email);
    
    // Save basic user data
    await saveUserData({
      email: email || '',
      name: 'User',
      homeArea: '',
    });
    
    router.replace('/(tabs)/(home)/');
  };

  const handleSignUp = async () => {
    if (!email || !password || !name || !homeArea) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    console.log('Signing up:', { email, name, homeArea });
    
    // Save user data with safe fallbacks
    await saveUserData({
      email: email || '',
      name: name || 'User',
      homeArea: homeArea || '',
    });
    
    router.replace('/(tabs)/(home)/');
  };

  const handleSocialLogin = (provider: string) => {
    console.log(`Logging in with ${provider}`);
    Alert.alert('Coming Soon', `${provider} login will be available soon!`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'android' && { paddingTop: 48 },
        ]}
      >
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: colors.card }]}>
            <MaterialIcons name="place" size={64} color={colors.primary} />
          </View>
          <Text style={[styles.appTitle, { color: colors.text }]}>MidPoint</Text>
          <Text style={[styles.appSubtitle, { color: colors.textSecondary }]}>
            Meet halfway without sharing your home address
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.formTitle, { color: colors.text }]}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </Text>

          {isSignUp && (
            <>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Home Area</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  value={homeArea}
                  onChangeText={setHomeArea}
                  placeholder="e.g., San Francisco, CA"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </>
          )}

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={isSignUp ? handleSignUp : handleEmailLogin}
          >
            <Text style={styles.buttonText}>
              {isSignUp ? 'Sign Up' : 'Log In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsSignUp(!isSignUp)}
          >
            <Text style={[styles.switchText, { color: colors.primary }]}>
              {isSignUp
                ? 'Already have an account? Log In'
                : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerContainer}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <View style={styles.socialButtons}>
          <TouchableOpacity
            style={[styles.socialButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleSocialLogin('Apple')}
          >
            <MaterialIcons name="apple" size={24} color={colors.text} />
            <Text style={[styles.socialButtonText, { color: colors.text }]}>Continue with Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleSocialLogin('Google')}
          >
            <MaterialIcons name="google" size={24} color={colors.text} />
            <Text style={[styles.socialButtonText, { color: colors.text }]}>Continue with Google</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
    elevation: 4,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  appSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  button: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
    marginHorizontal: 16,
  },
  socialButtons: {
    gap: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
  },
});

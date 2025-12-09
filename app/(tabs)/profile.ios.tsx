
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { useThemeColors } from '@/styles/commonStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_STORAGE_KEY = '@midpoint_user';

interface UserData {
  email?: string;
  name: string;
  homeArea: string;
  photo?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [homeArea, setHomeArea] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const userData: UserData = JSON.parse(stored);
        setName(userData?.name || '');
        setEmail(userData?.email || '');
        setHomeArea(userData?.homeArea || '');
        setProfilePhoto(userData?.photo || null);
        console.log('Loaded user data:', userData);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveUserData = async () => {
    try {
      const userData: UserData = {
        name: name || '',
        homeArea: homeArea || '',
        photo: profilePhoto || undefined,
      };
      
      // Only include email if it exists
      if (email) {
        userData.email = email;
      }
      
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      console.log('Saved user data:', userData);
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  };

  const handleSave = async () => {
    if (!name) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    console.log('Saving profile:', { name, email, homeArea, profilePhoto });
    await saveUserData();
    Alert.alert('Success', 'Profile updated successfully!');
    setIsEditing(false);
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant photo library access to change your profile photo.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0]?.uri;
        if (imageUri) {
          setProfilePhoto(imageUri);
          // Auto-save photo
          const userData: UserData = {
            name: name || '',
            homeArea: homeArea || '',
            photo: imageUri,
          };
          if (email) {
            userData.email = email;
          }
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
          Alert.alert('Success', 'Profile photo updated!');
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(USER_STORAGE_KEY);
              router.replace('/onboarding');
            } catch (error) {
              console.error('Error logging out:', error);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                <MaterialIcons name="person" size={48} color={colors.card} />
              </View>
            )}
            <TouchableOpacity
              style={[styles.editAvatarButton, { backgroundColor: colors.primary, borderColor: colors.card }]}
              onPress={handlePickImage}
            >
              <MaterialIcons name="camera-alt" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.userName, { color: colors.text }]}>
            {name || 'User'}
          </Text>
          
          {homeArea && (
            <Text style={[styles.homeArea, { color: colors.textSecondary }]}>
              {homeArea}
            </Text>
          )}
          
          {email ? (
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
              {email}
            </Text>
          ) : (
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Text style={[styles.addEmailText, { color: colors.primary }]}>
                Add email
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Profile Information</Text>
            <TouchableOpacity onPress={() => (isEditing ? handleSave() : setIsEditing(true))}>
              <Text style={[styles.editButton, { color: colors.primary }]}>{isEditing ? 'Save' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Name</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor={colors.textSecondary}
              />
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>{name || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Home Area</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={homeArea}
                onChangeText={setHomeArea}
                placeholder="e.g., San Francisco, CA"
                placeholderTextColor={colors.textSecondary}
              />
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>{homeArea || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Email</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>{email || 'Not set'}</Text>
            )}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Settings</Text>
          
          <TouchableOpacity 
            style={styles.settingItem} 
            onPress={() => router.push('/settings/notifications')}
          >
            <MaterialIcons name="notifications" size={24} color={colors.text} />
            <Text style={[styles.settingText, { color: colors.text }]}>Notifications</Text>
            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity 
            style={styles.settingItem} 
            onPress={() => router.push('/settings/privacy')}
          >
            <MaterialIcons name="lock" size={24} color={colors.text} />
            <Text style={[styles.settingText, { color: colors.text }]}>Privacy</Text>
            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity 
            style={styles.settingItem} 
            onPress={() => router.push('/settings/help')}
          >
            <MaterialIcons name="help" size={24} color={colors.text} />
            <Text style={[styles.settingText, { color: colors.text }]}>Help & Support</Text>
            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: colors.error }]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 },
  header: { alignItems: 'center', marginBottom: 32 },
  avatarContainer: { position: 'relative', marginBottom: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  editAvatarButton: { position: 'absolute', bottom: 0, right: 0, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  userName: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  homeArea: { fontSize: 16, marginBottom: 4 },
  userEmail: { fontSize: 14 },
  addEmailText: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  card: { borderRadius: 12, padding: 16, marginBottom: 16, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: 'bold' },
  editButton: { fontSize: 16, fontWeight: '600' },
  fieldContainer: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1 },
  fieldValue: { fontSize: 16, paddingVertical: 8 },
  divider: { height: 1, marginVertical: 16 },
  settingItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  settingText: { flex: 1, fontSize: 16 },
  logoutButton: { borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 16 },
  logoutText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

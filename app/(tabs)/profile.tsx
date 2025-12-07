
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { useThemeColors } from '@/styles/commonStyles';

const mockCurrentUser = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
  home_area: 'San Francisco, CA',
  preferences: 'Coffee shops, parks',
};

export default function ProfileScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(mockCurrentUser.name);
  const [homeArea, setHomeArea] = useState(mockCurrentUser.home_area);
  const [preferences, setPreferences] = useState(mockCurrentUser.preferences || '');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(mockCurrentUser.photo);

  const handleSave = () => {
    console.log('Saving profile:', { name, homeArea, preferences, profilePhoto });
    Alert.alert('Success', 'Profile updated successfully!');
    setIsEditing(false);
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant photo library access to upload a profile photo.',
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
        const imageUri = result.assets[0].uri;
        setProfilePhoto(imageUri);
        console.log('Profile photo updated:', imageUri);
        Alert.alert('Success', 'Profile photo updated!');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS === 'android' && { paddingTop: 48 },
          ]}
          keyboardShouldPersistTaps="handled"
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
                style={[styles.editAvatarButton, { backgroundColor: colors.secondary, borderColor: colors.card }]}
                onPress={handlePickImage}
              >
                <MaterialIcons name="camera-alt" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.email, { color: colors.textSecondary }]}>{mockCurrentUser.email}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Profile Information</Text>
              <TouchableOpacity
                onPress={() => (isEditing ? handleSave() : setIsEditing(true))}
              >
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
                <Text style={[styles.fieldValue, { color: colors.text }]}>{name}</Text>
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
                <Text style={[styles.fieldValue, { color: colors.text }]}>{homeArea}</Text>
              )}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Preferences</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  value={preferences}
                  onChangeText={setPreferences}
                  placeholder="Your preferences..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                />
              ) : (
                <Text style={[styles.fieldValue, { color: colors.text }]}>
                  {preferences || 'No preferences set'}
                </Text>
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

          <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.error }]}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
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
    paddingTop: 20,
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  email: {
    fontSize: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  editButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  fieldContainer: {
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
  fieldValue: {
    fontSize: 16,
    paddingVertical: 8,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
  },
  logoutButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

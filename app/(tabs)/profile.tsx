
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
  useColorScheme,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, useThemeColors } from '@/styles/commonStyles';
import { mockCurrentUser } from '@/data/mockData';

export default function ProfileScreen() {
  const themeColors = useThemeColors();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(mockCurrentUser.name);
  const [homeArea, setHomeArea] = useState(mockCurrentUser.home_area);
  const [preferences, setPreferences] = useState(mockCurrentUser.preferences || '');

  const handleSave = () => {
    console.log('Saving profile:', { name, homeArea, preferences });
    Alert.alert('Success', 'Profile updated successfully!');
    setIsEditing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'android' && { paddingTop: 48 },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {mockCurrentUser.photo ? (
              <Image source={{ uri: mockCurrentUser.photo }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={48}
                  color={colors.card}
                />
              </View>
            )}
            <TouchableOpacity style={styles.editAvatarButton}>
              <IconSymbol
                ios_icon_name="camera.fill"
                android_material_icon_name="camera-alt"
                size={20}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
          <Text style={[styles.email, { color: themeColors.textSecondary }]}>{mockCurrentUser.email}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: themeColors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: themeColors.text }]}>Profile Information</Text>
            <TouchableOpacity
              onPress={() => (isEditing ? handleSave() : setIsEditing(true))}
            >
              <Text style={styles.editButton}>{isEditing ? 'Save' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: themeColors.text }]}>Name</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor={themeColors.textSecondary}
              />
            ) : (
              <Text style={[styles.fieldValue, { color: themeColors.text }]}>{name}</Text>
            )}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: themeColors.text }]}>Home Area</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
                value={homeArea}
                onChangeText={setHomeArea}
                placeholder="e.g., San Francisco, CA"
                placeholderTextColor={themeColors.textSecondary}
              />
            ) : (
              <Text style={[styles.fieldValue, { color: themeColors.text }]}>{homeArea}</Text>
            )}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: themeColors.text }]}>Preferences</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
                value={preferences}
                onChangeText={setPreferences}
                placeholder="Your preferences..."
                placeholderTextColor={themeColors.textSecondary}
                multiline
                numberOfLines={3}
              />
            ) : (
              <Text style={[styles.fieldValue, { color: themeColors.text }]}>
                {preferences || 'No preferences set'}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.cardTitle, { color: themeColors.text }]}>Settings</Text>
          <TouchableOpacity style={styles.settingItem}>
            <IconSymbol
              ios_icon_name="bell.fill"
              android_material_icon_name="notifications"
              size={24}
              color={themeColors.text}
            />
            <Text style={[styles.settingText, { color: themeColors.text }]}>Notifications</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={24}
              color={themeColors.textSecondary}
            />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <TouchableOpacity style={styles.settingItem}>
            <IconSymbol
              ios_icon_name="lock.fill"
              android_material_icon_name="lock"
              size={24}
              color={themeColors.text}
            />
            <Text style={[styles.settingText, { color: themeColors.text }]}>Privacy</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={24}
              color={themeColors.textSecondary}
            />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <TouchableOpacity style={styles.settingItem}>
            <IconSymbol
              ios_icon_name="questionmark.circle.fill"
              android_material_icon_name="help"
              size={24}
              color={themeColors.text}
            />
            <Text style={[styles.settingText, { color: themeColors.text }]}>Help & Support</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={24}
              color={themeColors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
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
    backgroundColor: colors.primary,
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
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.card,
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
    color: colors.primary,
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
    backgroundColor: colors.error,
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

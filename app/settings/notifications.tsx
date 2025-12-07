
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@midpoint_notifications';

interface NotificationSettings {
  appNotifications: boolean;
  midpointReminders: boolean;
  newMeetRequests: boolean;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  const [settings, setSettings] = useState<NotificationSettings>({
    appNotifications: true,
    midpointReminders: true,
    newMeetRequests: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
        console.log('Loaded notification settings:', JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      console.log('Saved notification settings:', newSettings);
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  };

  const handleToggle = (key: keyof NotificationSettings) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key],
    };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[
        styles.header,
        Platform.OS === 'android' && { paddingTop: 48 }
      ]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.card }]}
        >
          <MaterialIcons name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Notification Preferences
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            Manage how you receive notifications from MidPoint
          </Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="notifications" size={24} color={colors.primary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>
                  App Notifications
                </Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Receive general app notifications
                </Text>
              </View>
            </View>
            <Switch
              value={settings.appNotifications}
              onValueChange={() => handleToggle('appNotifications')}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={settings.appNotifications ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="place" size={24} color={colors.accent} />
              <View style={styles.settingText}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>
                  Midpoint Reminders
                </Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Get reminded about upcoming meetups
                </Text>
              </View>
            </View>
            <Switch
              value={settings.midpointReminders}
              onValueChange={() => handleToggle('midpointReminders')}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={settings.midpointReminders ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="person-add" size={24} color={colors.secondary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>
                  New Meet Requests
                </Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Be notified when someone wants to meet
                </Text>
              </View>
            </View>
            <Switch
              value={settings.newMeetRequests}
              onValueChange={() => handleToggle('newMeetRequests')}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={settings.newMeetRequests ? colors.primary : colors.textSecondary}
            />
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <MaterialIcons name="info" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            You can change these settings at any time. Notifications help you stay connected with your meetups.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});


import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function PrivacyScreen() {
  const router = useRouter();
  const colors = useThemeColors();

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.iconHeader}>
            <MaterialIcons name="lock" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Your Privacy Matters
          </Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            At MidPoint, we take your privacy seriously. This page explains how we handle your data and protect your information.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            How We Use Your Location
          </Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            • Your location is only accessed when you actively use the app to find a midpoint{'\n'}
            • We calculate meeting points in real-time and do not store your exact location permanently{'\n'}
            • Safe Meet mode hides your exact address from other users{'\n'}
            • Location data is never shared with third parties{'\n'}
            • You can revoke location permissions at any time in your device settings
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            What Data We Store
          </Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            • Your profile information (name, email, photo){'\n'}
            • Your saved contacts and their locations (if provided){'\n'}
            • Your meetup history and preferences{'\n'}
            • App settings and notification preferences{'\n'}
            • All data is encrypted and stored securely
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Your Rights
          </Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            You have the right to:{'\n\n'}
            • Access all data we have about you{'\n'}
            • Request corrections to your data{'\n'}
            • Delete your account and all associated data{'\n'}
            • Export your data in a portable format{'\n'}
            • Opt out of non-essential data collection
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Data Deletion
          </Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            To request deletion of your account and all associated data, please contact us at privacy@midpointapp.com. We will process your request within 30 days and confirm once your data has been permanently deleted from our systems.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Contact Us
          </Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            If you have any questions or concerns about your privacy, please contact our privacy team at:{'\n\n'}
            privacy@midpointapp.com
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
          <MaterialIcons name="info" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.text }]}>
            This privacy information was last updated on January 2024. We may update our privacy practices from time to time.
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
    padding: 20,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  iconHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
});

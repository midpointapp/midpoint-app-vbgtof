
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'How does MidPoint calculate the meeting location?',
    answer: 'MidPoint uses your device GPS and your contact\'s location to calculate the geographic midpoint between you. We then search for nearby public places like coffee shops, restaurants, and parks around that midpoint.',
  },
  {
    question: 'What is Safe Meet mode?',
    answer: 'Safe Meet mode hides your exact home address from other users. Instead of showing your precise location, it only displays public meeting places near the calculated midpoint, protecting your privacy.',
  },
  {
    question: 'Why does the app need my location?',
    answer: 'MidPoint needs your location to calculate the halfway point between you and your contacts. Your location is only used when you actively find a midpoint and is never stored permanently or shared with third parties.',
  },
  {
    question: 'Can I use MidPoint without sharing my exact location?',
    answer: 'Yes! Use Safe Meet mode to hide your exact address. The app will still calculate a midpoint and suggest public meeting places without revealing your precise location to other users.',
  },
  {
    question: 'How do I invite someone to use MidPoint?',
    answer: 'After selecting a contact, tap the "Send Download Link via SMS" button. This will open your messaging app with a pre-filled message containing the download link for MidPoint.',
  },
];

export default function HelpAndSupportScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  const handleContactSupport = async () => {
    const deviceInfo = `
Device: ${Device.modelName || 'Unknown'}
OS: ${Platform.OS} ${Platform.Version}
App Version: ${Constants.expoConfig?.version || '1.0.0'}
    `.trim();

    const subject = 'MidPoint Support Request';
    const body = `Hi MidPoint Support,

I need help with:
[Please describe your issue here]

---
Device Information:
${deviceInfo}
    `;

    const mailtoUrl = `mailto:support@midpointapp.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        Alert.alert(
          'Email Not Available',
          'Please send an email to support@midpointapp.com with your question or issue.',
          [
            {
              text: 'Copy Email',
              onPress: () => {
                console.log('Email copied: support@midpointapp.com');
                Alert.alert('Copied', 'Email address copied to clipboard');
              },
            },
            { text: 'OK' },
          ]
        );
      }
    } catch (error) {
      console.error('Error opening email:', error);
      Alert.alert(
        'Error',
        'Could not open email app. Please email us at support@midpointapp.com',
        [{ text: 'OK' }]
      );
    }
  };

  const toggleFAQ = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.iconHeader}>
            <MaterialIcons name="help" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            How can we help you?
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            Find answers to common questions or contact our support team
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Frequently Asked Questions
          </Text>
          {FAQ_ITEMS.map((item, index) => (
            <React.Fragment key={index}>
              <TouchableOpacity
                style={styles.faqItem}
                onPress={() => toggleFAQ(index)}
                activeOpacity={0.7}
              >
                <View style={styles.faqHeader}>
                  <Text style={[styles.faqQuestion, { color: colors.text }]}>
                    {item.question}
                  </Text>
                  <MaterialIcons
                    name={expandedIndex === index ? 'expand-less' : 'expand-more'}
                    size={24}
                    color={colors.textSecondary}
                  />
                </View>
                {expandedIndex === index && (
                  <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
                    {item.answer}
                  </Text>
                )}
              </TouchableOpacity>
              {index < FAQ_ITEMS.length - 1 && (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.contactButton, { backgroundColor: colors.primary }]}
          onPress={handleContactSupport}
          activeOpacity={0.8}
        >
          <MaterialIcons name="email" size={20} color="#FFFFFF" />
          <Text style={styles.contactButtonText}>Contact Support</Text>
        </TouchableOpacity>

        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <MaterialIcons name="schedule" size={20} color={colors.textSecondary} />
          <View style={styles.infoTextContainer}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              Support Hours
            </Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Monday - Friday: 9 AM - 6 PM PST{'\n'}
              We typically respond within 24 hours
            </Text>
          </View>
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
    marginBottom: 8,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  faqItem: {
    paddingVertical: 12,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    paddingRight: 24,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 18,
    borderRadius: 12,
    marginBottom: 16,
    boxShadow: '0px 4px 12px rgba(63, 81, 181, 0.3)',
    elevation: 4,
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
});

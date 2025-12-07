
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import * as Contacts from 'expo-contacts';

interface SavedContact {
  id: string;
  name: string;
  initials: string;
}

export default function MeetNowScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const isSafeMode = params.safeMode === 'true';

  const [selectedContact, setSelectedContact] = useState<SavedContact | null>(null);
  const [type, setType] = useState('');
  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([
    { id: '1', name: 'Mom', initials: 'M' },
    { id: '2', name: 'Sarah', initials: 'S' },
    { id: '3', name: 'Chris', initials: 'C' },
    { id: '4', name: 'Alex', initials: 'A' },
  ]);

  const handleSelectContact = (contact: SavedContact) => {
    setSelectedContact(contact);
    console.log('Selected contact:', contact.name);
  };

  const handlePickFromContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status === 'granted') {
        const contact = await Contacts.presentContactPickerAsync();
        
        if (contact) {
          const firstName = contact.firstName || '';
          const lastName = contact.lastName || '';
          const fullName = `${firstName} ${lastName}`.trim() || 'Unknown';
          const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'U';
          
          const newContact: SavedContact = {
            id: contact.id || Date.now().toString(),
            name: fullName,
            initials: initials,
          };
          
          setSelectedContact(newContact);
          console.log('Selected contact from device:', newContact.name);
        }
      } else {
        Alert.alert(
          'Permission Required',
          'Please grant contacts permission to select from your contacts.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error picking contact:', error);
      Alert.alert('Error', 'Failed to access contacts. Please try again.');
    }
  };

  const handleFind = () => {
    if (!selectedContact) {
      Alert.alert('No Contact Selected', 'Please select a contact to meet with.');
      return;
    }

    console.log('Find midpoint with:', { 
      person: selectedContact.name, 
      type,
      safeMode: isSafeMode 
    });
    
    if (isSafeMode) {
      console.log('Safe Meet mode: Only public locations will be suggested');
    }
    
    router.back();
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      {isSafeMode && (
        <View style={[styles.safeModeIndicator, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
          <Text style={[styles.safeModeText, { color: colors.success }]}>
            🔒 Safe Meet ON
          </Text>
          <Text style={[styles.safeModeSubtext, { color: colors.textSecondary }]}>
            Your exact location will be hidden
          </Text>
        </View>
      )}

      <Text style={[styles.title, { color: colors.text }]}>Meet in the Middle</Text>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>Who are you meeting?</Text>
        
        {selectedContact ? (
          <View style={[styles.selectedContactCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <View style={[styles.contactAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.contactInitials}>{selectedContact.initials}</Text>
            </View>
            <Text style={[styles.selectedContactName, { color: colors.text }]}>
              {selectedContact.name}
            </Text>
            <TouchableOpacity 
              onPress={() => setSelectedContact(null)}
              style={styles.removeButton}
            >
              <Text style={[styles.removeButtonText, { color: colors.error }]}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.contactSelectorContainer}>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Select from saved contacts:
            </Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.contactList}
              contentContainerStyle={styles.contactListContent}
            >
              {savedContacts.map((contact) => (
                <TouchableOpacity
                  key={contact.id}
                  style={styles.contactItem}
                  onPress={() => handleSelectContact(contact)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.contactCircle, { backgroundColor: colors.primary }]}>
                    <Text style={styles.contactInitials}>{contact.initials}</Text>
                  </View>
                  <Text style={[styles.contactName, { color: colors.text }]} numberOfLines={1}>
                    {contact.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.pickContactButton, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={handlePickFromContacts}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickContactButtonText, { color: colors.primary }]}>
                📱 Pick from Device Contacts
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>Type of meetup</Text>
        <TextInput
          style={[styles.input, { 
            backgroundColor: colors.card, 
            color: colors.text,
            borderColor: colors.border 
          }]}
          placeholder="Ex: Coffee, Meal, Marketplace Sale"
          placeholderTextColor={colors.textSecondary}
          value={type}
          onChangeText={setType}
        />
      </View>

      <TouchableOpacity
        style={[styles.findButton, { backgroundColor: colors.primary }]}
        onPress={handleFind}
        activeOpacity={0.8}
      >
        <Text style={styles.findButtonText}>Find Midpoint</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  safeModeIndicator: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 24,
    alignItems: 'center',
  },
  safeModeText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  safeModeSubtext: {
    fontSize: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 32,
  },
  section: {
    marginBottom: 28,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  selectedContactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedContactName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  removeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  contactSelectorContainer: {
    gap: 12,
  },
  contactList: {
    marginBottom: 16,
  },
  contactListContent: {
    gap: 16,
    paddingRight: 16,
  },
  contactItem: {
    alignItems: 'center',
    gap: 8,
    width: 80,
  },
  contactCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInitials: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  contactName: {
    fontSize: 14,
    textAlign: 'center',
  },
  pickContactButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  pickContactButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  findButton: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    boxShadow: '0px 4px 12px rgba(63, 81, 181, 0.3)',
    elevation: 4,
  },
  findButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

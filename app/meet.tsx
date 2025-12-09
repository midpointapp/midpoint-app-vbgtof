
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import * as Location from 'expo-location';
import { supabase } from '@/app/integrations/supabase/client';
import { calculateMidpoint, searchNearbyPlaces } from '@/utils/locationUtils';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_STORAGE_KEY = '@midpoint_user';

export default function MeetPointHandler() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const [status, setStatus] = useState('Processing your invite...');
  const [error, setError] = useState<string | null>(null);
  const [needsName, setNeedsName] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [meetPoint, setMeetPoint] = useState<any>(null);

  useEffect(() => {
    handleMeetPointInvite();
  }, []);

  const loadUserName = async (): Promise<string | null> => {
    try {
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const userData = JSON.parse(stored);
        return userData?.name || null;
      }
      return null;
    } catch (error) {
      console.error('Error loading user name:', error);
      return null;
    }
  };

  const handleMeetPointInvite = async () => {
    try {
      // Get meetPointId from URL
      const meetPointId = params?.meetPointId as string;

      if (!meetPointId) {
        console.error('No meetPointId in params');
        setError('invalid');
        return;
      }

      console.log('Processing MeetPoint invite:', meetPointId);
      setStatus('Looking up your Meet Point...');

      // Look up the MeetPoint in Supabase
      const { data: meetPointData, error: fetchError } = await supabase
        .from('meet_points')
        .select('*')
        .eq('meet_point_id', meetPointId)
        .single();

      if (fetchError || !meetPointData) {
        console.error('Error fetching MeetPoint:', fetchError);
        setError('notfound');
        return;
      }

      console.log('Found MeetPoint:', meetPointData);
      setMeetPoint(meetPointData);

      // Check if already joined
      if (meetPointData.status !== 'link_sent') {
        console.log('MeetPoint already processed, navigating to results');
        router.replace({
          pathname: '/midpoint-results',
          params: { meetPointId },
        });
        return;
      }

      // Check if we have a user name stored
      const storedName = await loadUserName();
      
      if (!storedName) {
        // Need to ask for name
        console.log('No stored name found, asking user for name');
        setNeedsName(true);
        setStatus('');
        return;
      }

      // Proceed with joining
      await joinMeetPoint(meetPointId, meetPointData, storedName);
    } catch (error: any) {
      console.error('Error handling MeetPoint invite:', error);
      setError('error');
    }
  };

  const handleSubmitName = async () => {
    if (!receiverName.trim()) {
      Alert.alert('Name Required', 'Please enter your name to continue.');
      return;
    }

    // Save name for future use
    try {
      await AsyncStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify({ name: receiverName.trim() })
      );
    } catch (error) {
      console.error('Error saving user name:', error);
    }

    // Proceed with joining
    const meetPointId = params?.meetPointId as string;
    await joinMeetPoint(meetPointId, meetPoint, receiverName.trim());
  };

  const joinMeetPoint = async (meetPointId: string, meetPointData: any, userName: string) => {
    try {
      setNeedsName(false);
      setStatus('Getting your location...');

      // Get receiver's GPS location
      const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();

      if (permissionStatus !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'MidPoint needs your location to calculate the meeting point. Please enable location access in Settings.',
          [{ text: 'OK', onPress: () => router.replace('/') }]
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let receiverLat = location.coords.latitude;
      let receiverLng = location.coords.longitude;

      // Mask coordinates if SafeMeet is on
      if (meetPointData.safe) {
        receiverLat = Math.round(receiverLat * 100) / 100;
        receiverLng = Math.round(receiverLng * 100) / 100;
        console.log('Masked coordinates for SafeMeet:', { receiverLat, receiverLng });
      }

      console.log('Receiver location obtained:', { receiverLat, receiverLng });

      setStatus('Calculating midpoint...');

      // Calculate midpoint
      const { midLat, midLng } = calculateMidpoint(
        meetPointData.sender_lat,
        meetPointData.sender_lng,
        receiverLat,
        receiverLng,
        meetPointData.safe
      );

      console.log('Midpoint calculated:', { midLat, midLng });

      setStatus('Finding nearby places...');

      // Search for hotspots near the midpoint
      const hotspots = await searchNearbyPlaces(midLat, midLng, meetPointData.type);

      console.log(`Found ${hotspots?.length || 0} hotspots`);

      // Set the first hotspot as the default selected place if available
      let selectedPlaceData = {};
      if (hotspots && hotspots.length > 0) {
        const firstPlace = hotspots[0];
        selectedPlaceData = {
          selected_place_id: firstPlace.id,
          selected_place_name: firstPlace.name,
          selected_place_lat: firstPlace.latitude,
          selected_place_lng: firstPlace.longitude,
          selected_place_address: firstPlace.address,
        };
        console.log('Setting default selected place:', selectedPlaceData);
      }

      setStatus('Joining Meet Point...');

      // Update the MeetPoint with receiver info, location, midpoint, hotspots, selected place, and status
      const { error: updateError } = await supabase
        .from('meet_points')
        .update({
          receiver_name: userName,
          receiver_lat: receiverLat,
          receiver_lng: receiverLng,
          midpoint_lat: midLat,
          midpoint_lng: midLng,
          hotspot_results: hotspots,
          ...selectedPlaceData,
          status: 'ready',
          updated_at: new Date().toISOString(),
        })
        .eq('meet_point_id', meetPointId);

      if (updateError) {
        console.error('Error updating MeetPoint:', updateError);
        Alert.alert(
          'Error',
          'Failed to update the Meet Point. Please try again.',
          [{ text: 'OK', onPress: () => router.replace('/') }]
        );
        return;
      }

      console.log('MeetPoint updated successfully with receiver name:', userName);
      console.log('Navigating to results page');

      // Small delay to ensure database update propagates
      await new Promise(resolve => setTimeout(resolve, 500));

      // Navigate to results page
      router.replace({
        pathname: '/midpoint-results',
        params: { meetPointId },
      });
    } catch (error: any) {
      console.error('Error joining MeetPoint:', error);
      Alert.alert(
        'Error',
        error?.message || 'Failed to join Meet Point. Please try again.',
        [{ text: 'OK', onPress: () => router.replace('/') }]
      );
    }
  };

  // Name input screen
  if (needsName) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.nameInputContainer}>
          <MaterialIcons name="person" size={64} color={colors.primary} />
          <Text style={[styles.nameInputTitle, { color: colors.text }]}>
            What&apos;s your name?
          </Text>
          <Text style={[styles.nameInputSubtitle, { color: colors.textSecondary }]}>
            This will be shared with the person you&apos;re meeting
          </Text>
          <TextInput
            style={[
              styles.nameInput,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="Enter your name"
            placeholderTextColor={colors.textSecondary}
            value={receiverName}
            onChangeText={setReceiverName}
            autoCapitalize="words"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSubmitName}
          />
          <TouchableOpacity
            style={[
              styles.nameSubmitButton,
              { backgroundColor: colors.primary },
              !receiverName.trim() && styles.nameSubmitButtonDisabled,
            ]}
            onPress={handleSubmitName}
            disabled={!receiverName.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.nameSubmitButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Error states
  if (error === 'invalid') {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <MaterialIcons name="link-off" size={80} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Invalid Link</Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          This invite link is missing required information. Please ask the sender to create a new invite.
        </Text>
        <TouchableOpacity
          style={[styles.errorButton, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/')}
          activeOpacity={0.8}
        >
          <Text style={styles.errorButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error === 'notfound') {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <MaterialIcons name="location-off" size={80} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Meet Point Not Found</Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          This Meet Point could not be found. It may have expired or been deleted.
        </Text>
        <TouchableOpacity
          style={[styles.errorButton, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/')}
          activeOpacity={0.8}
        >
          <Text style={styles.errorButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error === 'error') {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <MaterialIcons name="error-outline" size={80} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Something Went Wrong</Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          An unexpected error occurred. Please try again.
        </Text>
        <TouchableOpacity
          style={[styles.errorButton, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/')}
          activeOpacity={0.8}
        >
          <Text style={styles.errorButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.statusText, { color: colors.text }]}>{status}</Text>
      <Text style={[styles.statusSubtext, { color: colors.textSecondary }]}>
        Please wait while we set up your Meet Point...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  statusText: {
    marginTop: 24,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusSubtext: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  nameInputContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: 16,
  },
  nameInputTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
  },
  nameInputSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  nameInput: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  nameSubmitButton: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  nameSubmitButtonDisabled: {
    opacity: 0.5,
  },
  nameSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  errorButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

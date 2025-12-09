
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import * as Location from 'expo-location';
import { supabase } from '@/app/integrations/supabase/client';
import { calculateMidpoint, searchNearbyPlaces } from '@/utils/locationUtils';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function MeetPointHandler() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const [status, setStatus] = useState('Processing your invite...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleMeetPointInvite();
  }, []);

  const handleMeetPointInvite = async () => {
    try {
      // Get meetPointId from URL
      const meetPointId = params?.meetPointId as string;

      if (!meetPointId) {
        setError('invalid');
        return;
      }

      console.log('Processing MeetPoint invite:', meetPointId);
      setStatus('Looking up your Meet Point...');

      // Look up the MeetPoint in Supabase
      const { data: meetPoint, error: fetchError } = await supabase
        .from('meet_points')
        .select('*')
        .eq('meet_point_id', meetPointId)
        .single();

      if (fetchError || !meetPoint) {
        console.error('Error fetching MeetPoint:', fetchError);
        setError('notfound');
        return;
      }

      console.log('Found MeetPoint:', meetPoint);

      // Check if already joined
      if (meetPoint.status !== 'link_sent') {
        console.log('MeetPoint already processed, navigating to results');
        router.replace({
          pathname: '/midpoint-results',
          params: { meetPointId },
        });
        return;
      }

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

      const receiverLat = location.coords.latitude;
      const receiverLng = location.coords.longitude;

      console.log('Receiver location obtained:', { receiverLat, receiverLng });

      setStatus('Calculating midpoint...');

      // Calculate midpoint
      const { midLat, midLng } = calculateMidpoint(
        meetPoint.sender_lat,
        meetPoint.sender_lng,
        receiverLat,
        receiverLng,
        meetPoint.safe
      );

      console.log('Midpoint calculated:', { midLat, midLng });

      setStatus('Finding nearby places...');

      // Search for hotspots near the midpoint
      const hotspots = await searchNearbyPlaces(midLat, midLng, meetPoint.type);

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

      // Update the MeetPoint with receiver location, midpoint, hotspots, selected place, and status
      const { error: updateError } = await supabase
        .from('meet_points')
        .update({
          receiver_lat: receiverLat,
          receiver_lng: receiverLng,
          midpoint_lat: midLat,
          midpoint_lng: midLng,
          hotspot_results: hotspots,
          ...selectedPlaceData,
          status: 'ready',
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

      console.log('MeetPoint updated successfully, navigating to results');

      // Navigate to results page
      router.replace({
        pathname: '/midpoint-results',
        params: { meetPointId },
      });
    } catch (error: any) {
      console.error('Error handling MeetPoint invite:', error);
      setError('error');
    }
  };

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
    fontSize: 16,
    textAlign: 'center',
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


import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  Platform, 
  Linking,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  ActivityIndicator,
  Share,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { generateShareUrl } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/app/integrations/supabase/client';
import { generateId } from '@/utils/idGenerator';
import { calculateMidpoint, searchNearbyPlaces } from '@/utils/locationUtils';
import type { RealtimeChannel } from '@supabase/supabase-js';

const USER_STORAGE_KEY = '@midpoint_user';

// Dropdown ordering based on mode
const MEETUP_TYPES_SAFE = [
  { id: 'police', label: 'Police station', icon: 'local-police' as const },
  { id: 'gas', label: 'Gas stations', icon: 'local-gas-station' as const },
  { id: 'restaurant', label: 'Food', icon: 'restaurant' as const },
  { id: 'cafe', label: 'Coffee', icon: 'local-cafe' as const },
  { id: 'shopping_mall', label: 'Shopping', icon: 'shopping-cart' as const },
  { id: 'park', label: 'Parks', icon: 'park' as const },
  { id: 'point_of_interest', label: 'Other', icon: 'place' as const },
];

const MEETUP_TYPES_REGULAR = [
  { id: 'restaurant', label: 'Food', icon: 'restaurant' as const },
  { id: 'gas', label: 'Gas stations', icon: 'local-gas-station' as const },
  { id: 'cafe', label: 'Coffee', icon: 'local-cafe' as const },
  { id: 'shopping_mall', label: 'Shopping', icon: 'shopping-cart' as const },
  { id: 'park', label: 'Parks', icon: 'park' as const },
  { id: 'point_of_interest', label: 'Other', icon: 'place' as const },
  { id: 'police', label: 'Police station', icon: 'local-police' as const },
];

interface SavedContact {
  id: string;
  name: string;
  initials: string;
  phoneNumber?: string;
}

interface LocationWithAddress {
  latitude: number;
  longitude: number;
  address?: string;
}

interface Place {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  distance: number;
  placeId?: string;
}

interface MeetPoint {
  id: string;
  meet_point_id: string;
  sender_name: string;
  sender_lat: number;
  sender_lng: number;
  receiver_name: string | null;
  receiver_lat: number | null;
  receiver_lng: number | null;
  type: string;
  safe: boolean;
  status: 'link_sent' | 'joined' | 'ready';
  midpoint_lat: number | null;
  midpoint_lng: number | null;
  hotspot_results: any | null;
  selected_place_id: string | null;
  selected_place_name: string | null;
  selected_place_lat: number | null;
  selected_place_lng: number | null;
  selected_place_address: string | null;
  created_at: string;
  updated_at: string;
}

export default function MeetNowScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const isSafeMode = params?.safeMode === 'true';
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Check if we're in session view mode (meetPointId present)
  const [sessionMeetPointId, setSessionMeetPointId] = useState<string | null>(null);
  const [isSessionMode, setIsSessionMode] = useState(false);

  // Session view state
  const [sessionMeetPoint, setSessionMeetPoint] = useState<MeetPoint | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionPlaces, setSessionPlaces] = useState<Place[]>([]);
  const [midpointAddress, setMidpointAddress] = useState<string | null>(null);

  // Create mode state
  const [currentUserName, setCurrentUserName] = useState('User');
  const [selectedContact, setSelectedContact] = useState<SavedContact | null>(null);
  const [selectedMeetupType, setSelectedMeetupType] = useState<string | null>(null);
  const [showMeetupTypeDropdown, setShowMeetupTypeDropdown] = useState(false);
  const [myLocation, setMyLocation] = useState<LocationWithAddress | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [creatingMeetPoint, setCreatingMeetPoint] = useState(false);
  const [currentMeetPoint, setCurrentMeetPoint] = useState<MeetPoint | null>(null);
  const [showReadyBanner, setShowReadyBanner] = useState(false);
  
  // "Meet Someone Else" form state
  const [showMeetSomeoneElseModal, setShowMeetSomeoneElseModal] = useState(false);
  const [otherPersonName, setOtherPersonName] = useState('');
  const [otherPersonPhone, setOtherPersonPhone] = useState('');

  // Select the appropriate dropdown list based on mode
  const MEETUP_TYPES = isSafeMode ? MEETUP_TYPES_SAFE : MEETUP_TYPES_REGULAR;

  // Check for meetPointId in URL on mount (especially for web)
  useEffect(() => {
    const checkForMeetPointId = () => {
      // First check URL params from expo-router
      if (params?.meetPointId) {
        const meetPointId = Array.isArray(params.meetPointId) 
          ? params.meetPointId[0] 
          : params.meetPointId;
        console.log('[MeetNow] detected meetPointId from URL params:', meetPointId);
        setSessionMeetPointId(meetPointId);
        setIsSessionMode(true);
        return;
      }

      // On web, also check window.location.search
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        const meetPointId = searchParams.get('meetPointId');
        if (meetPointId) {
          console.log('[MeetNow] detected meetPointId from window.location.search:', meetPointId);
          setSessionMeetPointId(meetPointId);
          setIsSessionMode(true);
          return;
        }
      }

      // No meetPointId found, stay in create mode
      console.log('[MeetNow] No meetPointId detected, staying in create mode');
      setIsSessionMode(false);
    };

    checkForMeetPointId();
  }, [params]);

  // Load session data when in session mode
  useEffect(() => {
    if (isSessionMode && sessionMeetPointId) {
      loadSessionMeetPoint(sessionMeetPointId);
    }
  }, [isSessionMode, sessionMeetPointId]);

  const loadSessionMeetPoint = async (meetPointId: string) => {
    try {
      setSessionLoading(true);
      setSessionError(null);
      console.log('[MeetNow] Loading session meet point:', meetPointId);

      // Fetch meet point from Supabase
      const { data, error } = await supabase
        .from('meet_points')
        .select('*')
        .eq('meet_point_id', meetPointId)
        .single();

      if (error || !data) {
        console.error('[MeetNow] Error loading meet point:', error);
        setSessionError('This meet link is invalid or expired.');
        setSessionLoading(false);
        return;
      }

      console.log('[MeetNow] Meet point loaded:', data);
      const meetPoint = data as MeetPoint;
      setSessionMeetPoint(meetPoint);

      // Check if already ready (both users joined and midpoint calculated)
      if (meetPoint.status === 'ready' && meetPoint.midpoint_lat && meetPoint.midpoint_lng) {
        console.log('[MeetNow] Meet point is already ready, displaying results');
        
        // Load places from hotspot_results
        if (meetPoint.hotspot_results && Array.isArray(meetPoint.hotspot_results)) {
          setSessionPlaces(meetPoint.hotspot_results);
        }
        
        // Reverse geocode midpoint
        await reverseGeocodeMidpoint(meetPoint.midpoint_lat, meetPoint.midpoint_lng);
        
        setSessionLoading(false);
        return;
      }

      // Check if we need to add this device's location
      if (!meetPoint.receiver_lat || !meetPoint.receiver_lng) {
        console.log('[MeetNow] Receiver location not set, capturing current location...');
        await captureAndUpdateReceiverLocation(meetPointId, meetPoint);
      } else if (meetPoint.status === 'joined') {
        // Both locations are set but not yet calculated, calculate midpoint and search places
        console.log('[MeetNow] Both users joined, calculating midpoint...');
        await calculateAndSearchPlaces(meetPoint);
      }

      setSessionLoading(false);
    } catch (error) {
      console.error('[MeetNow] Error in loadSessionMeetPoint:', error);
      setSessionError('Failed to load Meet Point');
      setSessionLoading(false);
    }
  };

  const reverseGeocodeMidpoint = async (latitude: number, longitude: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      
      if (results && results.length > 0) {
        const address = results[0];
        const parts = [
          address?.streetNumber,
          address?.street,
          address?.city,
          address?.region,
          address?.postalCode,
        ].filter(Boolean);
        
        const formattedAddress = parts.join(', ');
        console.log('[MeetNow] Midpoint address:', formattedAddress);
        setMidpointAddress(formattedAddress || null);
      }
    } catch (error) {
      console.error('[MeetNow] Error reverse geocoding:', error);
    }
  };

  const captureAndUpdateReceiverLocation = async (meetPointId: string, meetPoint: MeetPoint) => {
    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Please enable location access to join this Meet Point');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log('[MeetNow] Captured receiver location:', location.coords);

      // Mask coordinates if SafeMeet is on
      let receiverLat = location.coords.latitude;
      let receiverLng = location.coords.longitude;

      if (meetPoint.safe) {
        receiverLat = Math.round(receiverLat * 100) / 100;
        receiverLng = Math.round(receiverLng * 100) / 100;
        console.log('[MeetNow] Masked receiver coordinates for SafeMeet:', { receiverLat, receiverLng });
      }

      // Get receiver name from storage
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      let receiverName = 'User';
      if (stored) {
        const userData = JSON.parse(stored);
        receiverName = userData?.name || 'User';
      }

      // Update meet point with receiver location
      const { error } = await supabase
        .from('meet_points')
        .update({
          receiver_lat: receiverLat,
          receiver_lng: receiverLng,
          receiver_name: receiverName,
          status: 'joined',
        })
        .eq('meet_point_id', meetPointId);

      if (error) {
        console.error('[MeetNow] Error updating receiver location:', error);
        Alert.alert('Error', 'Failed to update your location');
        return;
      }

      console.log('[MeetNow] Receiver location updated successfully');

      // Calculate midpoint and search places
      const updatedMeetPoint = {
        ...meetPoint,
        receiver_lat: receiverLat,
        receiver_lng: receiverLng,
        receiver_name: receiverName,
        status: 'joined' as const,
      };

      setSessionMeetPoint(updatedMeetPoint);
      await calculateAndSearchPlaces(updatedMeetPoint);
    } catch (error) {
      console.error('[MeetNow] Error capturing receiver location:', error);
      Alert.alert('Error', 'Failed to get your location');
    }
  };

  const calculateAndSearchPlaces = async (meetPoint: MeetPoint) => {
    try {
      if (!meetPoint.receiver_lat || !meetPoint.receiver_lng) {
        console.log('[MeetNow] Cannot calculate midpoint, receiver location missing');
        return;
      }

      console.log('[MeetNow] Calculating midpoint and searching places...');

      // Calculate midpoint
      const { midLat, midLng } = calculateMidpoint(
        meetPoint.sender_lat,
        meetPoint.sender_lng,
        meetPoint.receiver_lat,
        meetPoint.receiver_lng,
        meetPoint.safe
      );

      console.log('[MeetNow] Midpoint calculated:', { midLat, midLng });

      // Reverse geocode midpoint
      await reverseGeocodeMidpoint(midLat, midLng);

      // Search for nearby places
      const places = await searchNearbyPlaces(midLat, midLng, meetPoint.type);
      console.log('[MeetNow] Found places:', places.length);
      setSessionPlaces(places);

      // Update meet point in Supabase with midpoint and results
      const { error } = await supabase
        .from('meet_points')
        .update({
          midpoint_lat: midLat,
          midpoint_lng: midLng,
          hotspot_results: places,
          status: 'ready',
          selected_place_id: places.length > 0 ? places[0].id : null,
          selected_place_name: places.length > 0 ? places[0].name : null,
          selected_place_lat: places.length > 0 ? places[0].latitude : null,
          selected_place_lng: places.length > 0 ? places[0].longitude : null,
          selected_place_address: places.length > 0 ? places[0].address : null,
        })
        .eq('meet_point_id', meetPoint.meet_point_id);

      if (error) {
        console.error('[MeetNow] Error updating meet point with results:', error);
      } else {
        console.log('[MeetNow] Meet point updated with results');
        // Reload to get updated data
        const { data } = await supabase
          .from('meet_points')
          .select('*')
          .eq('meet_point_id', meetPoint.meet_point_id)
          .single();
        if (data) {
          setSessionMeetPoint(data as MeetPoint);
        }
      }
    } catch (error) {
      console.error('[MeetNow] Error in calculateAndSearchPlaces:', error);
      Alert.alert('Error', 'Failed to calculate midpoint and search places');
    }
  };

  const loadUserName = async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const userData = JSON.parse(stored);
        setCurrentUserName(userData?.name || 'User');
      }
    } catch (error) {
      console.error('Error loading user name:', error);
    }
  };

  const reverseGeocode = async (latitude: number, longitude: number): Promise<string | null> => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      
      if (results && results.length > 0) {
        const address = results[0];
        const parts = [
          address?.streetNumber,
          address?.street,
          address?.city,
          address?.region,
          address?.postalCode,
        ].filter(Boolean);
        
        const formattedAddress = parts.join(', ');
        console.log('Reverse geocoded address:', formattedAddress);
        return formattedAddress || null;
      }
      return null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  };

  const getCurrentLocation = useCallback(async () => {
    try {
      setLocationLoading(true);
      setLocationError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setLocationError('Location access denied. Enable in Settings.');
        Alert.alert(
          'Location Access Denied',
          'Location access denied. Please enable it in Settings to use MidPoint.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Cancel' }
          ]
        );
        setLocationLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const address = isSafeMode ? null : await reverseGeocode(location.coords.latitude, location.coords.longitude);

      setMyLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: address || undefined,
      });

      console.log('Location obtained:', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address,
      });

      setLocationLoading(false);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Failed to get location. Check location services.');
      Alert.alert(
        'Location Error',
        'Unable to get your current location. Please make sure location services are enabled in Settings.',
        [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'Retry', onPress: getCurrentLocation },
          { text: 'Cancel' }
        ]
      );
      setLocationLoading(false);
    }
  }, [isSafeMode]);

  useEffect(() => {
    // Only load user name and location if NOT in session mode
    if (!isSessionMode) {
      loadUserName();
      getCurrentLocation();
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [getCurrentLocation, isSessionMode]);

  const subscribeToMeetPoint = (meetPointId: string) => {
    // Check if already subscribed
    if (channelRef.current?.state === 'subscribed') {
      console.log('Already subscribed to MeetPoint channel');
      return;
    }

    console.log('Subscribing to MeetPoint updates:', meetPointId);

    const channel = supabase
      .channel(`meetpoint:${meetPointId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meet_points',
          filter: `meet_point_id=eq.${meetPointId}`,
        },
        (payload) => {
          console.log('MeetPoint updated:', payload);
          if (payload.new) {
            const updatedMeetPoint = payload.new as MeetPoint;
            setCurrentMeetPoint(updatedMeetPoint);

            // Show banner when status changes to joined or ready
            if (updatedMeetPoint.status === 'joined' || updatedMeetPoint.status === 'ready') {
              setShowReadyBanner(true);
            }

            // Navigate to results when ready
            if (updatedMeetPoint.status === 'ready') {
              setTimeout(() => {
                router.push({
                  pathname: '/midpoint-results',
                  params: { meetPointId },
                });
              }, 2000);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    channelRef.current = channel;
  };

  const handlePickFromContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status === 'granted') {
        const contact = await Contacts.presentContactPickerAsync();
        
        if (contact) {
          const firstName = contact?.firstName || '';
          const lastName = contact?.lastName || '';
          const fullName = `${firstName} ${lastName}`.trim() || 'Unknown';
          const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'U';
          
          const phoneNumber = contact?.phoneNumbers && contact.phoneNumbers.length > 0 
            ? contact.phoneNumbers[0]?.number 
            : undefined;
          
          const newContact: SavedContact = {
            id: contact?.id || Date.now().toString(),
            name: fullName,
            initials: initials,
            phoneNumber: phoneNumber,
          };
          
          setSelectedContact(newContact);
          console.log('Selected contact from device:', newContact.name, phoneNumber);
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

  const handleMeetSomeoneElse = () => {
    setShowMeetSomeoneElseModal(true);
  };

  const handleSubmitMeetSomeoneElse = () => {
    if (!otherPersonName.trim()) {
      Alert.alert('Name Required', 'Please enter a name or label for the person you&apos;re meeting.');
      return;
    }

    // Create a contact object from the form data
    const initials = otherPersonName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2) || 'U';

    const newContact: SavedContact = {
      id: Date.now().toString(),
      name: otherPersonName.trim(),
      initials: initials,
      phoneNumber: otherPersonPhone.trim() || undefined,
    };

    setSelectedContact(newContact);
    setShowMeetSomeoneElseModal(false);
    
    // Reset form
    setOtherPersonName('');
    setOtherPersonPhone('');

    console.log('Created contact for "Meet Someone Else":', newContact);
  };

  const handleCreateAndShareMeetPoint = async () => {
    if (!selectedContact) {
      Alert.alert('No Contact Selected', 'Please select a contact first.');
      return;
    }

    if (!myLocation) {
      Alert.alert('Location Required', 'Please wait for your location to be obtained before creating a Meet Point.');
      return;
    }

    if (!selectedMeetupType) {
      Alert.alert('Meetup Type Required', 'Please select a meetup type before creating a Meet Point.');
      return;
    }

    try {
      setCreatingMeetPoint(true);

      // Generate unique meetPointId using Safari-safe function
      const meetPointId = generateId();

      console.log('Creating MeetPoint:', {
        meetPointId,
        senderName: currentUserName,
        type: selectedMeetupType,
        safe: isSafeMode,
      });

      // Mask coordinates if SafeMeet is on
      let senderLat = myLocation.latitude;
      let senderLng = myLocation.longitude;

      if (isSafeMode) {
        senderLat = Math.round(senderLat * 100) / 100;
        senderLng = Math.round(senderLng * 100) / 100;
        console.log('Masked coordinates for SafeMeet:', { senderLat, senderLng });
      }

      // Create MeetPoint in Supabase
      const { data, error } = await supabase
        .from('meet_points')
        .insert([
          {
            meet_point_id: meetPointId,
            sender_name: currentUserName,
            sender_lat: senderLat,
            sender_lng: senderLng,
            type: selectedMeetupType,
            safe: isSafeMode,
            status: 'link_sent',
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating MeetPoint:', error);
        Alert.alert('Error', 'Failed to create Meet Point. Please try again.');
        setCreatingMeetPoint(false);
        return;
      }

      console.log('MeetPoint created successfully:', data);
      setCurrentMeetPoint(data as MeetPoint);

      // Validate meetPointId before proceeding
      if (!meetPointId) {
        alert("Error: missing meetPointId, cannot send invite.");
        setCreatingMeetPoint(false);
        return;
      }

      // Build the share URL using the helper function
      const shareUrl = generateShareUrl(meetPointId);
      console.log("[Invite] FINAL SMS link:", shareUrl);

      // Subscribe to real-time updates
      subscribeToMeetPoint(meetPointId);

      // Build share message using the shareUrl variable
      const message = `Hey ${selectedContact.name}! I'd like to meet you halfway. Open this link to share your location and find our meeting spot:\n\n${shareUrl}`;

      // Log the final SMS body before sending
      console.log("[Invite] FINAL SMS body:", message);

      // Check if we have a phone number and SMS is available
      const hasSMS = await SMS.isAvailableAsync();
      const hasPhoneNumber = selectedContact.phoneNumber && selectedContact.phoneNumber.trim().length > 0;

      if (hasSMS && hasPhoneNumber) {
        // Show options: SMS or Share Link
        Alert.alert(
          'Share Meet Point',
          'How would you like to share the Meet Point?',
          [
            {
              text: 'Send SMS',
              onPress: async () => {
                try {
                  console.log('[Invite] Sending SMS to:', selectedContact.phoneNumber);
                  
                  const { result } = await SMS.sendSMSAsync(
                    [selectedContact.phoneNumber!],
                    message
                  );
                  console.log('SMS result:', result);
                  setCreatingMeetPoint(false);
                  
                  if (result === 'sent') {
                    Alert.alert(
                      'Invite Sent!',
                      'Your Meet Point invite has been sent via SMS. You\'ll be notified when they open it.',
                      [{ text: 'OK' }]
                    );
                  }
                } catch (error) {
                  console.error('Error sending SMS:', error);
                  Alert.alert('Error', 'Failed to send SMS. Please try again.');
                  setCreatingMeetPoint(false);
                }
              },
            },
            {
              text: 'Share Link',
              onPress: async () => {
                try {
                  console.log('[Invite] Sharing link');
                  
                  const shareResult = await Share.share({
                    message: message,
                    title: 'MidPoint Meet Invite',
                  });

                  console.log('Share result:', shareResult);
                  setCreatingMeetPoint(false);

                  if (shareResult.action === Share.sharedAction) {
                    Alert.alert(
                      'Invite Sent!',
                      'Your Meet Point invite has been shared. You\'ll be notified when they open it.',
                      [{ text: 'OK' }]
                    );
                  }
                } catch (error) {
                  console.error('Error sharing:', error);
                  Alert.alert('Error', 'Failed to share link. Please try again.');
                  setCreatingMeetPoint(false);
                }
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setCreatingMeetPoint(false),
            },
          ]
        );
      } else {
        // Only Share Link option available
        try {
          console.log('[Invite] Sharing link');
          
          const shareResult = await Share.share({
            message: message,
            title: 'MidPoint Meet Invite',
          });

          console.log('Share result:', shareResult);
          setCreatingMeetPoint(false);

          if (shareResult.action === Share.sharedAction) {
            Alert.alert(
              'Invite Sent!',
              'Your Meet Point invite has been shared. You\'ll be notified when they open it.',
              [{ text: 'OK' }]
            );
          }
        } catch (error) {
          console.error('Error sharing:', error);
          setCreatingMeetPoint(false);
          Alert.alert('Error', 'Failed to share link. Please try again.');
        }
      }
    } catch (error: any) {
      console.error('Error creating and sharing MeetPoint:', error);
      setCreatingMeetPoint(false);
      Alert.alert(
        'Error',
        error?.message || 'Failed to create Meet Point. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSelectPlace = async (place: Place) => {
    if (!sessionMeetPoint) {
      return;
    }

    console.log('[MeetNow] Selecting place:', place.name);

    try {
      const { error } = await supabase
        .from('meet_points')
        .update({
          selected_place_id: place.id,
          selected_place_name: place.name,
          selected_place_lat: place.latitude,
          selected_place_lng: place.longitude,
          selected_place_address: place.address,
        })
        .eq('meet_point_id', sessionMeetPoint.meet_point_id);

      if (error) {
        console.error('[MeetNow] Error updating selected place:', error);
        Alert.alert('Error', 'Failed to update selected place');
        return;
      }

      // Update local state
      setSessionMeetPoint({
        ...sessionMeetPoint,
        selected_place_id: place.id,
        selected_place_name: place.name,
        selected_place_lat: place.latitude,
        selected_place_lng: place.longitude,
        selected_place_address: place.address,
      });

      console.log('[MeetNow] Selected place updated successfully');
    } catch (error) {
      console.error('[MeetNow] Error selecting place:', error);
      Alert.alert('Error', 'Failed to update selected place');
    }
  };

  const handleGetDirections = (place?: Place) => {
    const targetPlace = place || (sessionMeetPoint?.selected_place_lat && sessionMeetPoint?.selected_place_lng 
      ? {
          latitude: sessionMeetPoint.selected_place_lat,
          longitude: sessionMeetPoint.selected_place_lng,
          name: sessionMeetPoint.selected_place_name || 'Selected Place',
        }
      : null);

    if (!targetPlace) {
      Alert.alert('Error', 'No location selected');
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${targetPlace.latitude},${targetPlace.longitude}`;
    console.log('[MeetNow] Opening directions to:', targetPlace.name || 'location');

    Linking.openURL(url).catch((err) => {
      console.error('[MeetNow] Error opening maps:', err);
      Alert.alert('Error', 'Failed to open maps');
    });
  };

  const renderMeetupTypeItem = ({ item }: { item: typeof MEETUP_TYPES[0] }) => (
    <TouchableOpacity
      key={item?.id}
      style={[
        styles.dropdownItem,
        { backgroundColor: colors.card, borderColor: colors.border }
      ]}
      onPress={() => {
        setSelectedMeetupType(item?.id);
        setShowMeetupTypeDropdown(false);
      }}
      activeOpacity={0.7}
    >
      <MaterialIcons name={item?.icon || 'place'} size={24} color={colors.primary} />
      <Text style={[styles.dropdownItemText, { color: colors.text }]}>{item?.label || 'Unknown'}</Text>
      {selectedMeetupType === item?.id && (
        <MaterialIcons name="check" size={24} color={colors.success} />
      )}
    </TouchableOpacity>
  );

  const renderSessionPlaceItem = ({ item, index }: { item: Place; index: number }) => {
    const isSelected = sessionMeetPoint?.selected_place_id === item.id;

    return (
      <TouchableOpacity
        key={item?.id || `place-${index}`}
        style={[
          styles.sessionPlaceCard,
          { 
            backgroundColor: colors.card, 
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 3 : 1,
          }
        ]}
        onPress={() => handleSelectPlace(item)}
        activeOpacity={0.7}
      >
        {isSelected && (
          <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
            <Text style={styles.selectedBadgeText}>Selected</Text>
          </View>
        )}
        <View style={styles.placeHeader}>
          <View style={styles.placeRank}>
            <Text style={[styles.placeRankText, { color: colors.primary }]}>#{index + 1}</Text>
          </View>
          <View style={styles.placeInfo}>
            <Text style={[styles.placeName, { color: colors.text }]} numberOfLines={1}>
              {item?.name || 'Unknown Place'}
            </Text>
            <Text style={[styles.placeAddress, { color: colors.textSecondary }]} numberOfLines={2}>
              {item?.address || 'Address not available'}
            </Text>
            <View style={styles.placeMetrics}>
              {item?.rating > 0 && (
                <View style={styles.ratingContainer}>
                  <MaterialIcons name="star" size={16} color="#FFC107" />
                  <Text style={[styles.ratingText, { color: colors.text }]}>
                    {item.rating.toFixed(1)}
                  </Text>
                </View>
              )}
              <View style={styles.distanceContainer}>
                <MaterialIcons name="place" size={16} color={colors.textSecondary} />
                <Text style={[styles.distanceText, { color: colors.textSecondary }]}>
                  {item?.distance?.toFixed(1) || '0.0'} km
                </Text>
              </View>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.directionsButton, { backgroundColor: colors.primary }]}
          onPress={() => handleGetDirections(item)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="directions" size={20} color="#FFFFFF" />
          <Text style={styles.directionsButtonText}>Get Directions</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Render session view mode
  if (isSessionMode) {
    if (sessionLoading) {
      return (
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading Meet Point...</Text>
        </View>
      );
    }

    if (sessionError || !sessionMeetPoint) {
      return (
        <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
          <MaterialIcons name="error-outline" size={64} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            {sessionError || 'This meet link is invalid or expired.'}
          </Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            The Meet Point you&apos;re trying to access could not be found or has expired.
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.backButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Show waiting state ONLY if status is 'link_sent' (waiting for receiver to join)
    if (sessionMeetPoint.status === 'link_sent') {
      return (
        <View style={[styles.waitingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.waitingTitle, { color: colors.text }]}>
            Waiting for the other person to join...
          </Text>
          <Text style={[styles.waitingSubtitle, { color: colors.textSecondary }]}>
            This will update automatically when they open the link
          </Text>
        </View>
      );
    }

    // If status is 'joined' or 'ready', show the session view immediately
    // (even if midpoint calculation is still in progress)
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
      >
        {sessionMeetPoint.status === 'ready' && (
          <View style={[styles.successBanner, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
            <MaterialIcons name="check-circle" size={32} color={colors.success} />
            <Text style={[styles.successText, { color: colors.success }]}>
              Your Meet Point is ready!
            </Text>
          </View>
        )}

        {sessionMeetPoint.status === 'joined' && (
          <View style={[styles.waitingBanner, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.waitingBannerText, { color: colors.primary }]}>
              Calculating midpoint and searching for places...
            </Text>
          </View>
        )}

        <Text style={[styles.title, { color: colors.text }]}>Meet Point Session</Text>

        {/* Midpoint Info - only show if calculated */}
        {sessionMeetPoint.midpoint_lat && sessionMeetPoint.midpoint_lng && (
          <View style={[styles.midpointCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.midpointHeader}>
              <MaterialIcons name="place" size={32} color={colors.primary} />
              <Text style={[styles.midpointTitle, { color: colors.text }]}>Midpoint Location</Text>
            </View>

            {midpointAddress && (
              <Text style={[styles.midpointAddress, { color: colors.text }]} numberOfLines={2}>
                {midpointAddress}
              </Text>
            )}

            <Text style={[styles.midpointCoords, { color: colors.textSecondary }]}>
              {sessionMeetPoint.midpoint_lat?.toFixed(4)}, {sessionMeetPoint.midpoint_lng?.toFixed(4)}
            </Text>
          </View>
        )}

        {/* Map Placeholder */}
        <View style={[styles.mapPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MaterialIcons name="map" size={48} color={colors.textSecondary} />
          <Text style={[styles.mapPlaceholderText, { color: colors.textSecondary }]}>
            Map view with markers for both users and the midpoint
          </Text>
          <Text style={[styles.mapPlaceholderSubtext, { color: colors.textSecondary }]}>
            (react-native-maps not supported in Natively)
          </Text>
        </View>

        {/* Suggested Places */}
        <View style={styles.placesSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Suggested Places ({sessionPlaces.length})
          </Text>

          {sessionPlaces.length > 0 ? (
            <FlatList
              data={sessionPlaces}
              renderItem={renderSessionPlaceItem}
              keyExtractor={(item, index) => item?.id || `place-${index}`}
              scrollEnabled={false}
              contentContainerStyle={styles.placesList}
            />
          ) : (
            <View style={[styles.noPlacesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MaterialIcons name="info-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.noPlacesText, { color: colors.textSecondary }]}>
                {sessionMeetPoint.status === 'joined' 
                  ? 'Searching for places near the midpoint...'
                  : 'No places found near the midpoint'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  // Render create mode (original UI)
  const selectedMeetupTypeLabel = MEETUP_TYPES.find(t => t?.id === selectedMeetupType)?.label;

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
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

        {showReadyBanner && currentMeetPoint && (
          <View style={[styles.readyBanner, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
            <MaterialIcons name="check-circle" size={24} color={colors.success} />
            <Text style={[styles.readyBannerText, { color: colors.success }]}>
              Your Meet Point is ready!
            </Text>
          </View>
        )}

        {currentMeetPoint && currentMeetPoint.status === 'link_sent' && (
          <View style={[styles.waitingBanner, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.waitingBannerText, { color: colors.primary }]}>
              Waiting for them to open your Meet Point...
            </Text>
          </View>
        )}

        <Text style={[styles.title, { color: colors.text }]}>Meet in the Middle</Text>

        <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.locationHeader}>
            <Text style={[styles.locationLabel, { color: colors.text }]}>Your Location</Text>
            {locationLoading && (
              <Text style={[styles.locationStatus, { color: colors.textSecondary }]}>Getting location...</Text>
            )}
            {locationError && (
              <TouchableOpacity onPress={getCurrentLocation}>
                <Text style={[styles.locationStatus, { color: colors.error }]}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
          {myLocation ? (
            <View style={styles.locationInfo}>
              <Text style={[styles.locationText, { color: colors.success }]}>
                ✓ Location obtained
              </Text>
              {myLocation.address && !isSafeMode && (
                <Text style={[styles.addressText, { color: colors.text }]} numberOfLines={2}>
                  {myLocation.address}
                </Text>
              )}
              <Text style={[styles.coordinatesText, { color: colors.textSecondary }]}>
                {myLocation.latitude.toFixed(4)}, {myLocation.longitude.toFixed(4)}
              </Text>
            </View>
          ) : locationError ? (
            <View>
              <Text style={[styles.locationText, { color: colors.error }]}>
                {locationError}
              </Text>
              <TouchableOpacity 
                style={[styles.settingsButton, { backgroundColor: colors.primary }]}
                onPress={() => Linking.openSettings()}
              >
                <Text style={styles.settingsButtonText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[styles.locationText, { color: colors.textSecondary }]}>
              Waiting for location...
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Who are you meeting?</Text>
          
          {selectedContact ? (
            <View style={[styles.selectedContactCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
              <View style={[styles.contactAvatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.contactInitials}>{selectedContact?.initials || 'U'}</Text>
              </View>
              <View style={styles.selectedContactInfo}>
                <Text style={[styles.selectedContactName, { color: colors.text }]}>
                  {selectedContact?.name || 'Unknown'}
                </Text>
                {selectedContact?.phoneNumber && (
                  <Text style={[styles.contactPhoneText, { color: colors.textSecondary }]}>
                    {selectedContact.phoneNumber}
                  </Text>
                )}
              </View>
              <TouchableOpacity 
                onPress={() => setSelectedContact(null)}
                style={styles.removeButton}
              >
                <Text style={[styles.removeButtonText, { color: colors.error }]}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.contactSelectorContainer}>
              <TouchableOpacity
                style={[styles.pickContactButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={handlePickFromContacts}
                activeOpacity={0.7}
              >
                <MaterialIcons name="contacts" size={24} color={colors.primary} />
                <Text style={[styles.pickContactButtonText, { color: colors.primary }]}>
                  Pick from Device Contacts
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.pickContactButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={handleMeetSomeoneElse}
                activeOpacity={0.7}
              >
                <MaterialIcons name="person-add" size={24} color={colors.primary} />
                <Text style={[styles.pickContactButtonText, { color: colors.primary }]}>
                  Meet Someone Else
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Meetup Type</Text>
          <TouchableOpacity
            style={[styles.dropdownButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowMeetupTypeDropdown(true)}
            activeOpacity={0.7}
          >
            <MaterialIcons 
              name={selectedMeetupType ? MEETUP_TYPES.find(t => t?.id === selectedMeetupType)?.icon || 'place' : 'place'} 
              size={24} 
              color={selectedMeetupType ? colors.primary : colors.textSecondary} 
            />
            <Text style={[styles.dropdownButtonText, { color: selectedMeetupType ? colors.text : colors.textSecondary }]}>
              {selectedMeetupTypeLabel || 'Select meetup type...'}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.createButton, 
            { backgroundColor: colors.primary },
            (!myLocation || locationLoading || !selectedContact || !selectedMeetupType || creatingMeetPoint) && styles.createButtonDisabled
          ]}
          onPress={handleCreateAndShareMeetPoint}
          activeOpacity={0.8}
          disabled={!myLocation || locationLoading || !selectedContact || !selectedMeetupType || creatingMeetPoint}
        >
          {creatingMeetPoint ? (
            <View style={styles.loadingButtonContainer}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.createButtonText}>Creating...</Text>
            </View>
          ) : (
            <Text style={styles.createButtonText}>
              {isSafeMode ? 'Create Safe Meet Point' : 'Create Meet Point'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Meetup Type Dropdown Modal */}
      <Modal
        visible={showMeetupTypeDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMeetupTypeDropdown(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMeetupTypeDropdown(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: colors.background }]}>
            <View style={[styles.dropdownHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.dropdownTitle, { color: colors.text }]}>Select Meetup Type</Text>
              <TouchableOpacity onPress={() => setShowMeetupTypeDropdown(false)}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={MEETUP_TYPES}
              renderItem={renderMeetupTypeItem}
              keyExtractor={(item) => item?.id || 'unknown'}
              contentContainerStyle={styles.dropdownList}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Meet Someone Else Modal */}
      <Modal
        visible={showMeetSomeoneElseModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMeetSomeoneElseModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowMeetSomeoneElseModal(false)}
          >
            <TouchableOpacity 
              style={[styles.meetSomeoneElseModal, { backgroundColor: colors.background }]}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Meet Someone Else</Text>
                <TouchableOpacity onPress={() => setShowMeetSomeoneElseModal(false)}>
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.formContent}>
                <Text style={[styles.formDescription, { color: colors.textSecondary }]}>
                  Meeting someone who&apos;s not in your contacts? Enter their details below.
                </Text>

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Name / Label <Text style={{ color: colors.error }}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    placeholder="e.g., Facebook Buyer, Marketplace Seller"
                    placeholderTextColor={colors.textSecondary}
                    value={otherPersonName}
                    onChangeText={setOtherPersonName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Phone Number (Optional)
                  </Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    placeholder="e.g., +1 234 567 8900"
                    placeholderTextColor={colors.textSecondary}
                    value={otherPersonPhone}
                    onChangeText={setOtherPersonPhone}
                    keyboardType="phone-pad"
                  />
                  <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
                    Only used to pre-fill SMS if provided
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: colors.primary }]}
                  onPress={handleSubmitMeetSomeoneElse}
                  activeOpacity={0.8}
                >
                  <Text style={styles.submitButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  loadingButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  waitingTitle: {
    marginTop: 24,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  waitingSubtitle: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 24,
  },
  successText: {
    fontSize: 18,
    fontWeight: '700',
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
  readyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
  },
  readyBannerText: {
    fontSize: 16,
    fontWeight: '700',
  },
  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
  },
  waitingBannerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  locationCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  locationInfo: {
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  coordinatesText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  settingsButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 28,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
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
  contactInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  selectedContactInfo: {
    flex: 1,
  },
  selectedContactName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  contactPhoneText: {
    fontSize: 12,
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
  pickContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  pickContactButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    width: '85%',
    maxHeight: '70%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  dropdownList: {
    padding: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
    gap: 12,
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 16,
  },
  createButton: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    boxShadow: '0px 4px 12px rgba(63, 81, 181, 0.3)',
    elevation: 4,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  meetSomeoneElseModal: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  formContent: {
    padding: 20,
  },
  formDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  formField: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  fieldHint: {
    fontSize: 12,
    marginTop: 6,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Session view styles
  midpointCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  midpointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  midpointTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  midpointAddress: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 22,
  },
  midpointCoords: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  mapPlaceholder: {
    padding: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    minHeight: 200,
  },
  mapPlaceholderText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  mapPlaceholderSubtext: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
  placesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  placesList: {
    gap: 12,
  },
  sessionPlaceCard: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  placeHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  placeRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(63, 81, 181, 0.1)',
  },
  placeRankText: {
    fontSize: 14,
    fontWeight: '700',
  },
  placeInfo: {
    flex: 1,
    gap: 4,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '700',
  },
  placeAddress: {
    fontSize: 14,
    lineHeight: 18,
  },
  placeMetrics: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 14,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  directionsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  noPlacesCard: {
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  noPlacesText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
});


import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@/styles/commonStyles';
import * as Location from 'expo-location';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from '@/app/integrations/supabase/client';
import { generateMidpointPlaces } from '@/utils/sessionUtils';
import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

interface SessionPlace {
  id: string;
  session_id: string;
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rank: number;
  rating: number;
  distance: number;
  created_at: string;
}

interface MeetSession {
  id: string;
  category: string;
  sender_lat: number;
  sender_lng: number;
  receiver_lat: number | null;
  receiver_lng: number | null;
  status: 'waiting_for_receiver' | 'connected' | 'proposed' | 'confirmed' | 'expired';
  invite_token: string;
  expires_at: string;
  proposed_place_id: string | null;
  confirmed_place_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function SessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const sessionChannelRef = useRef<RealtimeChannel | null>(null);
  const placesChannelRef = useRef<RealtimeChannel | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [session, setSession] = useState<MeetSession | null>(null);
  const [places, setPlaces] = useState<SessionPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReceiver, setIsReceiver] = useState(false);
  const [isSender, setIsSender] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [generatingPlaces, setGeneratingPlaces] = useState(false);

  // Extract sessionId and token from URL params
  useEffect(() => {
    const extractParams = () => {
      // Check URL params from expo-router
      if (params?.sessionId) {
        const id = Array.isArray(params.sessionId) 
          ? params.sessionId[0] 
          : params.sessionId;
        const token = params?.token 
          ? (Array.isArray(params.token) ? params.token[0] : params.token)
          : null;
        
        console.log('[Session] sessionId from params:', id);
        console.log('[Session] token from params:', token);
        setSessionId(id);
        setInviteToken(token);
        return;
      }

      // On web, also check window.location.search
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        const id = searchParams.get('sessionId');
        const token = searchParams.get('token');
        
        if (id) {
          console.log('[Session] sessionId from window.location:', id);
          console.log('[Session] token from window.location:', token);
          setSessionId(id);
          setInviteToken(token);
          return;
        }
      }

      // No sessionId found
      console.log('[Session] No sessionId found');
      setError('No session ID provided');
      setLoading(false);
    };

    extractParams();
  }, [params]);

  // Load session data when sessionId is available
  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId, inviteToken);
    }
  }, [sessionId, inviteToken]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!sessionId || !session) return;

    console.log('[Session] Setting up realtime subscriptions for session:', sessionId);

    // Check if already subscribed
    if (sessionChannelRef.current?.state === 'subscribed') {
      console.log('[Session] Already subscribed to session channel');
      return;
    }

    // Subscribe to session changes
    const sessionChannel = supabase
      .channel(`session:${sessionId}`, {
        config: { private: true }
      })
      .on('broadcast', { event: 'UPDATE' }, (payload) => {
        console.log('[Session] Received session update:', payload);
        if (payload.payload?.new) {
          const updatedSession = payload.payload.new as MeetSession;
          setSession(updatedSession);
        }
      })
      .subscribe((status) => {
        console.log('[Session] Session channel status:', status);
      });

    sessionChannelRef.current = sessionChannel;

    // Subscribe to session_places changes
    const placesChannel = supabase
      .channel(`session:${sessionId}:places`, {
        config: { private: true }
      })
      .on('broadcast', { event: 'INSERT' }, (payload) => {
        console.log('[Session] Received places insert:', payload);
        if (payload.payload?.new) {
          const newPlace = payload.payload.new as SessionPlace;
          setPlaces(prev => {
            // Check if place already exists
            if (prev.some(p => p.id === newPlace.id)) {
              return prev;
            }
            // Add and sort by rank
            return [...prev, newPlace].sort((a, b) => a.rank - b.rank);
          });
        }
      })
      .subscribe((status) => {
        console.log('[Session] Places channel status:', status);
      });

    placesChannelRef.current = placesChannel;

    return () => {
      if (sessionChannelRef.current) {
        console.log('[Session] Unsubscribing from session channel');
        supabase.removeChannel(sessionChannelRef.current);
        sessionChannelRef.current = null;
      }
      if (placesChannelRef.current) {
        console.log('[Session] Unsubscribing from places channel');
        supabase.removeChannel(placesChannelRef.current);
        placesChannelRef.current = null;
      }
    };
  }, [sessionId, session]);

  const loadSession = async (id: string, token: string | null) => {
    try {
      setLoading(true);
      setError(null);
      console.log('[Session] Loading session:', id);

      // Fetch session from Supabase
      const { data, error: fetchError } = await supabase
        .from('meet_sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !data) {
        console.error('[Session] Error loading session:', fetchError);
        setError('This session link is invalid or expired.');
        setLoading(false);
        return;
      }

      console.log('[Session] Session loaded:', data);
      const sessionData = data as MeetSession;
      
      // Check if expired
      if (new Date(sessionData.expires_at) < new Date()) {
        console.log('[Session] Session expired');
        setError('This session has expired.');
        setLoading(false);
        return;
      }

      setSession(sessionData);

      // Determine if this is sender or receiver
      // If receiver location is not set, this is the receiver
      if (!sessionData.receiver_lat || !sessionData.receiver_lng) {
        console.log('[Session] This is the receiver');
        setIsReceiver(true);
        setIsSender(false);
        // Capture receiver location
        await captureReceiverLocation(id, sessionData);
      } else {
        // Both locations are set, this is likely the sender viewing
        console.log('[Session] This is the sender or both users have joined');
        setIsSender(true);
        setIsReceiver(false);
        
        // Load places if they exist
        await loadSessionPlaces(id);
      }

      setLoading(false);
    } catch (err) {
      console.error('[Session] Error in loadSession:', err);
      setError('Failed to load session');
      setLoading(false);
    }
  };

  const loadSessionPlaces = async (id: string) => {
    try {
      console.log('[Session] Loading session places for:', id);
      
      const { data, error: fetchError } = await supabase
        .from('session_places')
        .select('*')
        .eq('session_id', id)
        .order('rank', { ascending: true });

      if (fetchError) {
        console.error('[Session] Error loading places:', fetchError);
        return;
      }

      if (data && data.length > 0) {
        console.log('[Session] Loaded places:', data.length);
        setPlaces(data as SessionPlace[]);
      }
    } catch (err) {
      console.error('[Session] Error loading places:', err);
    }
  };

  const captureReceiverLocation = async (id: string, sessionData: MeetSession) => {
    try {
      setUpdatingLocation(true);

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Please enable location access to join this session');
        setUpdatingLocation(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log('[Session] Captured receiver location:', location.coords);

      const receiverLat = location.coords.latitude;
      const receiverLng = location.coords.longitude;

      // Update session with receiver location and change status to 'connected'
      const { error: updateError } = await supabase
        .from('meet_sessions')
        .update({
          receiver_lat: receiverLat,
          receiver_lng: receiverLng,
          status: 'connected',
        })
        .eq('id', id);

      if (updateError) {
        console.error('[Session] Error updating receiver location:', updateError);
        Alert.alert('Error', 'Failed to update your location');
        setUpdatingLocation(false);
        return;
      }

      console.log('[Session] Receiver location updated successfully');

      // Update local state
      const updatedSession = {
        ...sessionData,
        receiver_lat: receiverLat,
        receiver_lng: receiverLng,
        status: 'connected' as const,
      };
      setSession(updatedSession);

      // Generate places
      await generatePlaces(id, updatedSession);
      
      setUpdatingLocation(false);
    } catch (err) {
      console.error('[Session] Error capturing receiver location:', err);
      Alert.alert('Error', 'Failed to get your location');
      setUpdatingLocation(false);
    }
  };

  const generatePlaces = async (id: string, sessionData: MeetSession) => {
    try {
      if (!sessionData.receiver_lat || !sessionData.receiver_lng) {
        console.log('[Session] Cannot generate places, receiver location missing');
        return;
      }

      setGeneratingPlaces(true);
      console.log('[Session] Generating places...');

      const sessionPlaces = await generateMidpointPlaces(
        id,
        sessionData.sender_lat,
        sessionData.sender_lng,
        sessionData.receiver_lat,
        sessionData.receiver_lng,
        sessionData.category
      );

      console.log('[Session] Places generated:', sessionPlaces.length);
      
      // Load places from database (they were inserted by generateMidpointPlaces)
      await loadSessionPlaces(id);
      
      setGeneratingPlaces(false);
    } catch (err) {
      console.error('[Session] Error generating places:', err);
      Alert.alert('Error', 'Failed to find meeting places');
      setGeneratingPlaces(false);
    }
  };

  const handleProposePlace = async (place: SessionPlace) => {
    if (!session) return;

    console.log('[Session] Proposing place:', place.name);

    try {
      const { error: updateError } = await supabase
        .from('meet_sessions')
        .update({
          proposed_place_id: place.place_id,
          status: 'proposed',
        })
        .eq('id', session.id);

      if (updateError) {
        console.error('[Session] Error proposing place:', updateError);
        Alert.alert('Error', 'Failed to propose place');
        return;
      }

      // Update local state
      setSession({
        ...session,
        proposed_place_id: place.place_id,
        status: 'proposed',
      });

      console.log('[Session] Place proposed successfully');
    } catch (err) {
      console.error('[Session] Error proposing place:', err);
      Alert.alert('Error', 'Failed to propose place');
    }
  };

  const handleAgreePlace = async () => {
    if (!session || !session.proposed_place_id) return;

    console.log('[Session] Agreeing to proposed place');

    try {
      const { error: updateError } = await supabase
        .from('meet_sessions')
        .update({
          confirmed_place_id: session.proposed_place_id,
          status: 'confirmed',
        })
        .eq('id', session.id);

      if (updateError) {
        console.error('[Session] Error confirming place:', updateError);
        Alert.alert('Error', 'Failed to confirm place');
        return;
      }

      // Update local state
      setSession({
        ...session,
        confirmed_place_id: session.proposed_place_id,
        status: 'confirmed',
      });

      console.log('[Session] Place confirmed successfully');
    } catch (err) {
      console.error('[Session] Error confirming place:', err);
      Alert.alert('Error', 'Failed to confirm place');
    }
  };

  const handleDenyPlace = async () => {
    if (!session) return;

    console.log('[Session] Denying proposed place');

    try {
      const { error: updateError } = await supabase
        .from('meet_sessions')
        .update({
          proposed_place_id: null,
          status: 'connected',
        })
        .eq('id', session.id);

      if (updateError) {
        console.error('[Session] Error denying place:', updateError);
        Alert.alert('Error', 'Failed to deny place');
        return;
      }

      // Update local state
      setSession({
        ...session,
        proposed_place_id: null,
        status: 'connected',
      });

      console.log('[Session] Place denied successfully');
    } catch (err) {
      console.error('[Session] Error denying place:', err);
      Alert.alert('Error', 'Failed to deny place');
    }
  };

  const handleGetDirections = (place: SessionPlace) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
    console.log('[Session] Opening directions to:', place.name);

    Linking.openURL(url).catch((err) => {
      console.error('[Session] Error opening maps:', err);
      Alert.alert('Error', 'Failed to open maps');
    });
  };

  const handleResendInvite = async () => {
    if (!session) return;

    const sessionUrl = `https://web-midpoint-app-vbgtof.natively.dev/?sessionId=${session.id}&token=${session.invite_token}`;
    
    if (Platform.OS === 'web') {
      try {
        await Clipboard.setStringAsync(sessionUrl);
        Alert.alert('Link Copied!', 'The invite link has been copied to your clipboard.');
      } catch (error) {
        console.error('[Session] Error copying link:', error);
        Alert.alert('Error', 'Failed to copy link');
      }
    } else {
      try {
        await Share.share({
          message: `Hey! I'd like to meet you halfway. Open this link:\n\n${sessionUrl}`,
          title: 'MidPoint Session Invite',
        });
      } catch (error) {
        console.error('[Session] Error sharing link:', error);
        Alert.alert('Error', 'Failed to share link');
      }
    }
  };

  const renderPlaceItem = ({ item, index }: { item: SessionPlace; index: number }) => {
    const isProposed = session?.proposed_place_id === item.place_id;
    const isConfirmed = session?.confirmed_place_id === item.place_id;
    const canPropose = session?.status === 'connected' && isSender;
    const canRespond = session?.status === 'proposed' && isReceiver && isProposed;

    return (
      <View
        key={item?.id || `place-${index}`}
        style={[
          styles.placeCard,
          { 
            backgroundColor: colors.card, 
            borderColor: isConfirmed ? colors.success : (isProposed ? colors.primary : colors.border),
            borderWidth: (isConfirmed || isProposed) ? 3 : 1,
          }
        ]}
      >
        {isConfirmed && (
          <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
            <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
            <Text style={styles.statusBadgeText}>Confirmed</Text>
          </View>
        )}
        {isProposed && !isConfirmed && (
          <View style={[styles.statusBadge, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="star" size={20} color="#FFFFFF" />
            <Text style={styles.statusBadgeText}>Proposed</Text>
          </View>
        )}
        
        <View style={styles.placeHeader}>
          <View style={[styles.placeRank, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.placeRankText, { color: colors.primary }]}>#{item.rank}</Text>
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

        <View style={styles.placeActions}>
          <TouchableOpacity
            style={[styles.directionsButton, { backgroundColor: colors.primary }]}
            onPress={() => handleGetDirections(item)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="directions" size={20} color="#FFFFFF" />
            <Text style={styles.directionsButtonText}>Directions</Text>
          </TouchableOpacity>

          {canPropose && !isProposed && (
            <TouchableOpacity
              style={[styles.proposeButton, { borderColor: colors.primary }]}
              onPress={() => handleProposePlace(item)}
              activeOpacity={0.8}
            >
              <Text style={[styles.proposeButtonText, { color: colors.primary }]}>Propose</Text>
            </TouchableOpacity>
          )}

          {canRespond && (
            <View style={styles.responseButtons}>
              <TouchableOpacity
                style={[styles.agreeButton, { backgroundColor: colors.success }]}
                onPress={handleAgreePlace}
                activeOpacity={0.8}
              >
                <MaterialIcons name="check" size={20} color="#FFFFFF" />
                <Text style={styles.agreeButtonText}>Agree</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.denyButton, { backgroundColor: colors.error }]}
                onPress={handleDenyPlace}
                activeOpacity={0.8}
              >
                <MaterialIcons name="close" size={20} color="#FFFFFF" />
                <Text style={styles.denyButtonText}>Deny</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          {updatingLocation ? 'Updating your location...' : 'Loading session...'}
        </Text>
      </View>
    );
  }

  // Error state
  if (error || !session) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <MaterialIcons name="error-outline" size={64} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          {error || 'Session Not Found'}
        </Text>
        <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
          The session you&apos;re trying to access could not be found or has expired.
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

  // UI State: Waiting for receiver
  if (session.status === 'waiting_for_receiver' && isSender) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.centerContent}>
            <MaterialIcons name="send" size={80} color={colors.primary} />
            <Text style={[styles.stateTitle, { color: colors.text }]}>
              Invite Sent
            </Text>
            <Text style={[styles.stateSubtitle, { color: colors.textSecondary }]}>
              Waiting for them to join...
            </Text>
            <Text style={[styles.stateDescription, { color: colors.textSecondary }]}>
              This will update automatically when they open the link and share their location.
            </Text>

            <TouchableOpacity
              style={[styles.resendButton, { borderColor: colors.primary }]}
              onPress={handleResendInvite}
              activeOpacity={0.8}
            >
              <MaterialIcons name="content-copy" size={20} color={colors.primary} />
              <Text style={[styles.resendButtonText, { color: colors.primary }]}>
                Copy / Resend Link
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // UI State: Receiver needs to share location
  if (session.status === 'waiting_for_receiver' && isReceiver) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Getting your location...
        </Text>
      </View>
    );
  }

  // UI State: Loading/generating places
  if (session.status === 'connected' && places.length === 0 && generatingPlaces) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.stateTitle, { color: colors.text }]}>
              Finding Meeting Places
            </Text>
            <Text style={[styles.stateSubtitle, { color: colors.textSecondary }]}>
              Calculating the midpoint and searching for nearby locations...
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // UI State: Confirmed
  if (session.status === 'confirmed') {
    const confirmedPlace = places.find(p => p.place_id === session.confirmed_place_id);
    
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.successBanner, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
            <MaterialIcons name="check-circle" size={48} color={colors.success} />
            <Text style={[styles.successTitle, { color: colors.success }]}>
              Meeting Place Confirmed!
            </Text>
          </View>

          {confirmedPlace && (
            <View style={[styles.confirmedPlaceCard, { backgroundColor: colors.card, borderColor: colors.success }]}>
              <Text style={[styles.confirmedPlaceLabel, { color: colors.textSecondary }]}>
                You&apos;re meeting at:
              </Text>
              <Text style={[styles.confirmedPlaceName, { color: colors.text }]}>
                {confirmedPlace.name}
              </Text>
              <Text style={[styles.confirmedPlaceAddress, { color: colors.textSecondary }]}>
                {confirmedPlace.address}
              </Text>

              <TouchableOpacity
                style={[styles.largeDirectionsButton, { backgroundColor: colors.primary }]}
                onPress={() => handleGetDirections(confirmedPlace)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="directions" size={24} color="#FFFFFF" />
                <Text style={styles.largeDirectionsButtonText}>Open in Maps</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            All Options
          </Text>
          <FlatList
            data={places}
            renderItem={renderPlaceItem}
            keyExtractor={(item, index) => item?.id || `place-${index}`}
            scrollEnabled={false}
            contentContainerStyle={styles.placesList}
          />
        </ScrollView>
      </View>
    );
  }

  // UI State: Showing 3 options (connected or proposed)
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      {session.status === 'proposed' && (
        <View style={[styles.proposedBanner, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
          <MaterialIcons name="star" size={32} color={colors.primary} />
          <Text style={[styles.proposedText, { color: colors.primary }]}>
            {isReceiver ? 'A place has been proposed!' : 'Waiting for response...'}
          </Text>
        </View>
      )}

      <Text style={[styles.title, { color: colors.text }]}>Meet Halfway</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Category: {session.category}
      </Text>

      {/* Map Placeholder */}
      <View style={[styles.mapPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MaterialIcons name="map" size={48} color={colors.textSecondary} />
        <Text style={[styles.mapPlaceholderText, { color: colors.textSecondary }]}>
          Map view with midpoint marker
        </Text>
        <Text style={[styles.mapPlaceholderSubtext, { color: colors.textSecondary }]}>
          (react-native-maps not supported in Natively)
        </Text>
      </View>

      {/* Meeting Places */}
      <View style={styles.placesSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Meeting Place Options ({places.length})
        </Text>

        {places.length > 0 ? (
          <FlatList
            data={places}
            renderItem={renderPlaceItem}
            keyExtractor={(item, index) => item?.id || `place-${index}`}
            scrollEnabled={false}
            contentContainerStyle={styles.placesList}
          />
        ) : (
          <View style={[styles.noPlacesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialIcons name="info-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.noPlacesText, { color: colors.textSecondary }]}>
              No places found near the midpoint
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
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
  stateTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
  },
  stateSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  stateDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginTop: 24,
  },
  resendButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  successBanner: {
    alignItems: 'center',
    gap: 12,
    padding: 24,
    borderRadius: 16,
    borderWidth: 3,
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  proposedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 24,
  },
  proposedText: {
    fontSize: 16,
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
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
    gap: 16,
  },
  placeCard: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  statusBadgeText: {
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
  placeActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    minWidth: 120,
  },
  directionsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  proposeButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    flex: 1,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  responseButtons: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  agreeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
  },
  agreeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  denyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
  },
  denyButtonText: {
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
  confirmedPlaceCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 3,
    marginBottom: 32,
    gap: 12,
  },
  confirmedPlaceLabel: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  confirmedPlaceName: {
    fontSize: 24,
    fontWeight: '700',
  },
  confirmedPlaceAddress: {
    fontSize: 16,
    lineHeight: 22,
  },
  largeDirectionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 12,
  },
  largeDirectionsButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

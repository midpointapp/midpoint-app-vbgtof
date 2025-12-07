
import { User, Session, SessionParticipant, Spot } from '@/types';

export const mockCurrentUser: User = {
  id: 'user-1',
  name: 'John Doe',
  email: 'john.doe@example.com',
  photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
  home_area: 'San Francisco, CA',
  current_lat: 37.7749,
  current_lng: -122.4194,
  preferences: 'Coffee lover, enjoys outdoor activities',
};

export const mockUsers: User[] = [
  mockCurrentUser,
  {
    id: 'user-2',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    home_area: 'Oakland, CA',
    current_lat: 37.8044,
    current_lng: -122.2712,
  },
  {
    id: 'user-3',
    name: 'Mike Johnson',
    email: 'mike.j@example.com',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
    home_area: 'Berkeley, CA',
    current_lat: 37.8715,
    current_lng: -122.2730,
  },
];

export const mockSessions: Session[] = [
  {
    id: 'session-1',
    title: 'Coffee Meetup',
    category: 'Coffee',
    creator_id: 'user-1',
    created_at: new Date().toISOString(),
    status: 'active',
    midpoint_lat: 37.7897,
    midpoint_lng: -122.2453,
    invite_code: 'COFFEE123',
  },
  {
    id: 'session-2',
    title: 'Lunch with Team',
    category: 'Meal',
    creator_id: 'user-1',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    status: 'completed',
    invite_code: 'LUNCH456',
  },
];

export const mockParticipants: SessionParticipant[] = [
  {
    id: 'part-1',
    session_id: 'session-1',
    user_id: 'user-1',
    user_name: 'John Doe',
    user_photo: mockUsers[0].photo,
    user_lat: 37.7749,
    user_lng: -122.4194,
    joined_at: new Date().toISOString(),
  },
  {
    id: 'part-2',
    session_id: 'session-1',
    user_id: 'user-2',
    user_name: 'Jane Smith',
    user_photo: mockUsers[1].photo,
    user_lat: 37.8044,
    user_lng: -122.2712,
    joined_at: new Date().toISOString(),
  },
];

export const mockSpots: Spot[] = [
  {
    id: 'spot-1',
    session_id: 'session-1',
    name: 'Blue Bottle Coffee',
    category: 'Coffee',
    lat: 37.7897,
    lng: -122.2453,
    address: '300 Webster St, Oakland, CA',
    distance: 0.5,
  },
  {
    id: 'spot-2',
    session_id: 'session-1',
    name: 'Starbucks Reserve',
    category: 'Coffee',
    lat: 37.7912,
    lng: -122.2468,
    address: '350 Grand Ave, Oakland, CA',
    distance: 0.7,
  },
  {
    id: 'spot-3',
    session_id: 'session-1',
    name: 'Local Coffee House',
    category: 'Coffee',
    lat: 37.7885,
    lng: -122.2440,
    address: '275 Lake Park Ave, Oakland, CA',
    distance: 0.3,
  },
];


export interface User {
  id: string;
  name: string;
  email: string;
  photo?: string;
  home_area: string;
  current_lat?: number;
  current_lng?: number;
  preferences?: string;
}

export interface Session {
  id: string;
  title: string;
  category: SessionCategory;
  creator_id: string;
  created_at: string;
  status: 'active' | 'completed' | 'cancelled';
  midpoint_lat?: number;
  midpoint_lng?: number;
  invite_code: string;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  user_name: string;
  user_photo?: string;
  user_lat?: number;
  user_lng?: number;
  joined_at: string;
}

export interface Spot {
  id: string;
  session_id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address?: string;
  distance?: number;
}

export type SessionCategory = 'Coffee' | 'Meal' | 'Marketplace Sale' | 'Gas' | 'Park' | 'General';

export const SESSION_CATEGORIES: SessionCategory[] = [
  'Coffee',
  'Meal',
  'Marketplace Sale',
  'Gas',
  'Park',
  'General',
];

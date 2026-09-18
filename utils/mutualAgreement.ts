// Pure meeting agreement rules. This module deliberately does not write to Supabase.
// Integrate only after server-side participant identity and atomic transitions are enforced.
export type Participant = 'sender' | 'receiver';
export type AgreementStatus = 'connected' | 'proposed' | 'confirmed';

export interface AgreementState {
  status: AgreementStatus;
  proposedPlaceId: string | null;
  proposedBy: Participant | null;
  confirmedPlaceId: string | null;
}

export type AgreementAction =
  | { type: 'propose'; actor: Participant; placeId: string }
  | { type: 'accept'; actor: Participant }
  | { type: 'reject'; actor: Participant };

export function transitionAgreement(state: AgreementState, action: AgreementAction): AgreementState {
  if (state.status === 'confirmed') throw new Error('Confirmed meetings cannot be changed.');

  if (action.type === 'propose') {
    if (!action.placeId.trim()) throw new Error('A meeting place is required.');
    if (state.status === 'proposed' && state.proposedBy === action.actor) {
      throw new Error('Wait for the other participant to respond.');
    }
    // A counterproposal replaces the pending proposal, but never confirms a meeting.
    return { status: 'proposed', proposedPlaceId: action.placeId, proposedBy: action.actor, confirmedPlaceId: null };
  }

  if (state.status !== 'proposed' || !state.proposedPlaceId || !state.proposedBy) {
    throw new Error('There is no pending proposal.');
  }
  if (state.proposedBy === action.actor) {
    throw new Error('Only the other participant may respond.');
  }

  if (action.type === 'accept') {
    return { status: 'confirmed', proposedPlaceId: state.proposedPlaceId, proposedBy: state.proposedBy, confirmedPlaceId: state.proposedPlaceId };
  }
  return { status: 'connected', proposedPlaceId: null, proposedBy: null, confirmedPlaceId: null };
}

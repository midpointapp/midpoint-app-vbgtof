import { transitionAgreement, type AgreementState } from '../utils/mutualAgreement';

const connected: AgreementState = {
  status: 'connected', proposedPlaceId: null, proposedBy: null, confirmedPlaceId: null,
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function rejects(fn: () => unknown, message: string) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  assert(threw, message);
}

export function runMutualAgreementTests() {
  const senderProposal = transitionAgreement(connected, { type: 'propose', actor: 'sender', placeId: 'place-a' });
  assert(senderProposal.status === 'proposed' && senderProposal.proposedBy === 'sender', 'Sender can propose');
  assert(senderProposal.confirmedPlaceId === null, 'Proposal must not auto-confirm');
  rejects(() => transitionAgreement(senderProposal, { type: 'accept', actor: 'sender' }), 'Proposer cannot self-accept');
  rejects(() => transitionAgreement(senderProposal, { type: 'reject', actor: 'sender' }), 'Proposer cannot self-reject');
  rejects(() => transitionAgreement(senderProposal, { type: 'propose', actor: 'sender', placeId: 'place-b' }), 'Proposer cannot overwrite own pending proposal');

  const confirmed = transitionAgreement(senderProposal, { type: 'accept', actor: 'receiver' });
  assert(confirmed.status === 'confirmed' && confirmed.confirmedPlaceId === 'place-a', 'Other participant can confirm exact proposed place');
  rejects(() => transitionAgreement(confirmed, { type: 'propose', actor: 'sender', placeId: 'place-b' }), 'Confirmed meeting immutable');

  const counter = transitionAgreement(senderProposal, { type: 'propose', actor: 'receiver', placeId: 'place-b' });
  assert(counter.status === 'proposed' && counter.proposedBy === 'receiver' && counter.proposedPlaceId === 'place-b', 'Receiver can counterpropose');
  assert(counter.confirmedPlaceId === null, 'Counterproposal must not confirm');
  rejects(() => transitionAgreement(counter, { type: 'accept', actor: 'receiver' }), 'Counterproposer cannot self-accept');
  const counterConfirmed = transitionAgreement(counter, { type: 'accept', actor: 'sender' });
  assert(counterConfirmed.status === 'confirmed' && counterConfirmed.confirmedPlaceId === 'place-b', 'Sender accepts counterproposal');

  const rejected = transitionAgreement(senderProposal, { type: 'reject', actor: 'receiver' });
  assert(rejected.status === 'connected' && rejected.proposedPlaceId === null && rejected.proposedBy === null, 'Reject resets pending proposal');
  rejects(() => transitionAgreement(connected, { type: 'accept', actor: 'receiver' }), 'Cannot accept absent proposal');
  rejects(() => transitionAgreement(connected, { type: 'propose', actor: 'sender', placeId: ' ' }), 'Blank place rejected');
  return true;
}

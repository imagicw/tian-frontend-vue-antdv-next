import { describe, expect, it } from 'vitest';

import {
  canChangeBooking,
  canCoordinateChange,
  canInitiateChange,
  canModifyBooking,
  canWithdrawChangeOrder,
  isOrderOwner,
  resolveRemoveOrderStrategy,
} from './change-logic';

describe('canModifyBooking', () => {
  it('is modifiable for draft (0) and rejected (3)', () => {
    expect(canModifyBooking(0)).toBe(true);
    expect(canModifyBooking('0')).toBe(true);
    expect(canModifyBooking(3)).toBe(true);
  });

  it('is not modifiable for submitted/confirmed/cancelled/shipped or missing status', () => {
    expect(canModifyBooking(1)).toBe(false);
    expect(canModifyBooking(2)).toBe(false);
    expect(canModifyBooking(4)).toBe(false);
    expect(canModifyBooking(6)).toBe(false);
    expect(canModifyBooking(undefined)).toBe(false);
  });
});

describe('isOrderOwner', () => {
  it('is true only when creator matches the current user id', () => {
    expect(isOrderOwner(1024, { creator: '1024' })).toBe(true);
  });

  it('is false for a different user (rejects unauthorized removal)', () => {
    expect(isOrderOwner(1, { creator: '1024' })).toBe(false);
  });

  it('is false when creator or current user id is missing', () => {
    expect(isOrderOwner(undefined, { creator: '1024' })).toBe(false);
    expect(isOrderOwner(1024, { creator: undefined })).toBe(false);
  });
});

describe('resolveRemoveOrderStrategy', () => {
  it('removes directly while the booking is still draft/rejected', () => {
    expect(resolveRemoveOrderStrategy(0)).toBe('direct');
    expect(resolveRemoveOrderStrategy(3)).toBe('direct');
  });

  it('requires a change draft once the booking is submitted/confirmed', () => {
    expect(resolveRemoveOrderStrategy(1)).toBe('change');
    expect(resolveRemoveOrderStrategy(2)).toBe('change');
  });
});

describe('canChangeBooking', () => {
  it('only allows collaboration while submitted/confirmed', () => {
    expect(canChangeBooking(1)).toBe(true);
    expect(canChangeBooking(2)).toBe(true);
    expect(canChangeBooking(0)).toBe(false);
    expect(canChangeBooking(3)).toBe(false);
    expect(canChangeBooking(4)).toBe(false);
    expect(canChangeBooking(6)).toBe(false);
  });
});

describe('canInitiateChange', () => {
  it('allows the booking applicant', () => {
    expect(canInitiateChange(10, { applicantId: 10, orders: [] })).toBe(true);
  });

  it('allows a responsible salesperson for any PO on the booking', () => {
    expect(
      canInitiateChange(20, {
        applicantId: 10,
        orders: [{ creator: '20' } as any],
      }),
    ).toBe(true);
  });

  it('rejects an unrelated user (repeat-initiation / unauthorized guard)', () => {
    expect(
      canInitiateChange(99, {
        applicantId: 10,
        orders: [{ creator: '20' } as any],
      }),
    ).toBe(false);
  });
});

describe('canCoordinateChange', () => {
  it('allows the change initiator or the booking applicant to withdraw/publish', () => {
    expect(
      canCoordinateChange(5, { initiatorId: 5 }, { applicantId: 10 }),
    ).toBe(true);
    expect(
      canCoordinateChange(10, { initiatorId: 5 }, { applicantId: 10 }),
    ).toBe(true);
  });

  it('rejects a bystander', () => {
    expect(
      canCoordinateChange(99, { initiatorId: 5 }, { applicantId: 10 }),
    ).toBe(false);
  });
});

describe('canWithdrawChangeOrder', () => {
  it('allows the change-order owner or delegated-for user', () => {
    expect(
      canWithdrawChangeOrder(1, {
        ownerUserId: 1,
        delegatedForUserId: undefined,
      }),
    ).toBe(true);
    expect(
      canWithdrawChangeOrder(2, { ownerUserId: 1, delegatedForUserId: 2 }),
    ).toBe(true);
  });

  it('rejects someone else (越权撤回被拒绝)', () => {
    expect(
      canWithdrawChangeOrder(99, { ownerUserId: 1, delegatedForUserId: 2 }),
    ).toBe(false);
  });
});

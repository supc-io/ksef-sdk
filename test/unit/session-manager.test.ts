import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { SessionManager } from '../../src/session-manager.js';
import { SessionError } from '../../src/errors/index.js';
import { FormCodes } from '../../src/types/common.js';

function session(referenceNumber = 'ref-1', keyLength = 32, ivLength = 16) {
  return {
    referenceNumber,
    validUntil: new Date(Date.now() + 60_000).toISOString(),
    formCode: FormCodes.FA3,
    symmetricKey: randomBytes(keyLength),
    initializationVector: randomBytes(ivLength),
  };
}

describe('SessionManager', () => {
  it('starts with no open session', () => {
    const sm = new SessionManager();
    expect(sm.isActive).toBe(false);
    expect(sm.session).toBeNull();
    expect(sm.referenceNumber).toBeNull();
    expect(() => sm.requireSession()).toThrow(SessionError);
    expect(() => sm.resolveReferenceNumber()).toThrow(SessionError);
  });

  it('stores a session with valid key material', () => {
    const sm = new SessionManager();
    const s = session();
    sm.setSession(s);
    expect(sm.isActive).toBe(true);
    expect(sm.referenceNumber).toBe('ref-1');
    expect(sm.requireSession()).toBe(s);
    expect(sm.resolveReferenceNumber()).toBe('ref-1');
    expect(sm.resolveReferenceNumber('other')).toBe('other');
  });

  it('rejects sessions without a reference number or with wrong key sizes', () => {
    const sm = new SessionManager();
    expect(() => sm.setSession(session(''))).toThrow(SessionError);
    expect(() => sm.setSession(session('ref', 16, 16))).toThrow(SessionError);
    expect(() => sm.setSession(session('ref', 32, 12))).toThrow(SessionError);
    expect(sm.isActive).toBe(false);
  });

  it('clear() forgets the session', () => {
    const sm = new SessionManager();
    sm.setSession(session());
    sm.clear();
    expect(sm.isActive).toBe(false);
  });
});

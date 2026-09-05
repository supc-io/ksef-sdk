import { describe, it, expect } from 'vitest';
import { SessionManager } from '../../src/session-manager.js';
import { SessionError } from '../../src/errors/index.js';

describe('SessionManager', () => {
  it('starts with no active session', () => {
    const sm = new SessionManager();
    expect(sm.isActive).toBe(false);
    expect(sm.sessionToken).toBeNull();
    expect(sm.referenceNumber).toBeNull();
  });

  it('setSession activates session', () => {
    const sm = new SessionManager();
    sm.setSession('token-123', 'ref-001');
    expect(sm.isActive).toBe(true);
    expect(sm.sessionToken).toBe('token-123');
    expect(sm.referenceNumber).toBe('ref-001');
  });

  it('rejects an empty token so isActive and requireToken never disagree', () => {
    const sm = new SessionManager();
    expect(() => sm.setSession('', 'ref-001')).toThrow(SessionError);
    expect(sm.isActive).toBe(false);
  });

  it('clear deactivates session', () => {
    const sm = new SessionManager();
    sm.setSession('token-123', 'ref-001');
    sm.clear();
    expect(sm.isActive).toBe(false);
    expect(sm.sessionToken).toBeNull();
  });

  it('requireToken returns token when active', () => {
    const sm = new SessionManager();
    sm.setSession('token-123', 'ref-001');
    expect(sm.requireToken()).toBe('token-123');
  });

  it('requireToken throws SessionError when no session', () => {
    const sm = new SessionManager();
    expect(() => sm.requireToken()).toThrow(SessionError);
    expect(() => sm.requireToken()).toThrow('No active session');
  });
});

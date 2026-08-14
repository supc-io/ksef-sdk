import { describe, it, expect } from 'vitest';
import { validateNip, normalizeNip } from '../../../src/utils/nip.js';

describe('validateNip', () => {
  it('validates correct NIP', () => {
    expect(validateNip('1234563218')).toBe(true);
  });

  it('validates NIP with dashes', () => {
    expect(validateNip('123-456-32-18')).toBe(true);
  });

  it('validates NIP with spaces', () => {
    expect(validateNip('123 456 32 18')).toBe(true);
  });

  it('rejects NIP with wrong checksum', () => {
    expect(validateNip('1234567890')).toBe(false);
  });

  it('rejects too short NIP', () => {
    expect(validateNip('12345')).toBe(false);
  });

  it('rejects too long NIP', () => {
    expect(validateNip('12345678901')).toBe(false);
  });

  it('rejects non-numeric NIP', () => {
    expect(validateNip('12345abcde')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateNip('')).toBe(false);
  });
});

describe('normalizeNip', () => {
  it('removes dashes', () => {
    expect(normalizeNip('123-456-32-18')).toBe('1234563218');
  });

  it('removes spaces', () => {
    expect(normalizeNip('123 456 32 18')).toBe('1234563218');
  });

  it('leaves clean NIP unchanged', () => {
    expect(normalizeNip('1234563218')).toBe('1234563218');
  });
});

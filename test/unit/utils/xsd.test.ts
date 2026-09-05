import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as childProcess from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { ConfigurationError, XsdValidationError } from '../../../src/errors/index.js';

// Only the xmllint invocation is mocked; the temp-file handling runs for real.
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const { validateXmlAgainstXsd } = await import('../../../src/utils/xsd.js');

const SAMPLE_XML = '<?xml version="1.0"?><Faktura/>';
const SCHEMA_PATH = '/path/to/FA2.xsd';

function xmllintFailure(status: number | null, stderr: string, code?: string): Error {
  return Object.assign(new Error('xmllint failed'), { status, stderr, code });
}

function xsdTempDirs(): string[] {
  return readdirSync(tmpdir()).filter((name) => name.startsWith('ksef-xsd-'));
}

describe('validateXmlAgainstXsd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not throw when XML is valid', () => {
    vi.mocked(childProcess.execFileSync).mockReturnValue('');

    expect(() => validateXmlAgainstXsd(SAMPLE_XML, SCHEMA_PATH)).not.toThrow();
  });

  it('calls xmllint with the schema and a real temp file, then removes the temp dir', () => {
    let xmlPathSeen = '';
    vi.mocked(childProcess.execFileSync).mockImplementation((_cmd, args) => {
      xmlPathSeen = String((args as string[])[3]);
      expect(existsSync(xmlPathSeen)).toBe(true);
      return '';
    });

    const before = xsdTempDirs().length;
    validateXmlAgainstXsd(SAMPLE_XML, SCHEMA_PATH);

    expect(childProcess.execFileSync).toHaveBeenCalledWith(
      'xmllint',
      ['--noout', '--schema', SCHEMA_PATH, xmlPathSeen],
      expect.objectContaining({ encoding: 'utf-8' }),
    );
    expect(xmlPathSeen).toMatch(/ksef-xsd-.*invoice\.xml$/);
    expect(existsSync(xmlPathSeen)).toBe(false);
    expect(xsdTempDirs().length).toBe(before);
  });

  it('throws XsdValidationError with parsed details on validation failure', () => {
    vi.mocked(childProcess.execFileSync).mockImplementation(() => {
      throw xmllintFailure(
        3,
        [
          "/tmp/ksef-xsd-mock/invoice.xml:5: element Kwota: Schemas validity error : Element 'Kwota': 'abc' is not a valid value",
          "/tmp/ksef-xsd-mock/invoice.xml:10: element NIP: Schemas validity error : Element 'NIP': Missing child element",
          '/tmp/ksef-xsd-mock/invoice.xml fails to validate',
        ].join('\n'),
      );
    });

    let caught: unknown;
    try {
      validateXmlAgainstXsd(SAMPLE_XML, SCHEMA_PATH);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(XsdValidationError);
    const xsdError = caught as XsdValidationError;
    expect(xsdError.details).toHaveLength(2);
    expect(xsdError.details[0].line).toBe(5);
    expect(xsdError.details[0].message).toContain('Kwota');
    expect(xsdError.details[1].line).toBe(10);
    expect(xsdError.details[1].message).toContain('NIP');
  });

  it('throws XsdValidationError with empty details for unparseable stderr', () => {
    vi.mocked(childProcess.execFileSync).mockImplementation(() => {
      throw xmllintFailure(4, 'some unexpected error output');
    });

    expect(() => validateXmlAgainstXsd(SAMPLE_XML, SCHEMA_PATH)).toThrow(XsdValidationError);
  });

  it('throws ConfigurationError when xmllint is not installed (ENOENT)', () => {
    vi.mocked(childProcess.execFileSync).mockImplementation(() => {
      throw Object.assign(new Error('spawnSync xmllint ENOENT'), { code: 'ENOENT', status: null });
    });

    expect(() => validateXmlAgainstXsd(SAMPLE_XML, SCHEMA_PATH)).toThrow(ConfigurationError);
    expect(() => validateXmlAgainstXsd(SAMPLE_XML, SCHEMA_PATH)).toThrow(/xmllint CLI not found/);
  });

  it('throws ConfigurationError when the XSD schema cannot be loaded (exit code 5)', () => {
    vi.mocked(childProcess.execFileSync).mockImplementation(() => {
      throw xmllintFailure(
        5,
        'warning: failed to load external entity "/path/to/FA2.xsd"\nSchemas parser error : Failed to locate the main schema resource at \'/path/to/FA2.xsd\'.\nWXS schema /path/to/FA2.xsd failed to compile',
      );
    });

    expect(() => validateXmlAgainstXsd(SAMPLE_XML, SCHEMA_PATH)).toThrow(ConfigurationError);
    expect(() => validateXmlAgainstXsd(SAMPLE_XML, SCHEMA_PATH)).toThrow(/could not be loaded/);
  });

  it('cleans up the temp dir even when xmllint fails', () => {
    vi.mocked(childProcess.execFileSync).mockImplementation(() => {
      throw xmllintFailure(3, 'x.xml:1: element A: Schemas validity error : bad');
    });

    const before = xsdTempDirs().length;
    expect(() => validateXmlAgainstXsd(SAMPLE_XML, SCHEMA_PATH)).toThrow(XsdValidationError);
    expect(xsdTempDirs().length).toBe(before);
  });
});

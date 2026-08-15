import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as childProcess from 'node:child_process';
import { XsdValidationError } from '../../../src/errors/index.js';

// Mock child_process before importing the module under test
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdtempSync: vi.fn(() => '/tmp/ksef-xsd-mock'),
}));

// Import after mocks are set up
const { validateXmlAgainstXsd } = await import('../../../src/utils/xsd.js');

const SAMPLE_XML = '<?xml version="1.0"?><Faktura/>';
const SCHEMA_PATH = '/path/to/FA2.xsd';

describe('validateXmlAgainstXsd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not throw when XML is valid', () => {
    vi.mocked(childProcess.execFileSync).mockReturnValue('');

    expect(() => validateXmlAgainstXsd(SAMPLE_XML, SCHEMA_PATH)).not.toThrow();
  });

  it('calls xmllint with correct arguments', () => {
    vi.mocked(childProcess.execFileSync).mockReturnValue('');

    validateXmlAgainstXsd(SAMPLE_XML, SCHEMA_PATH);

    expect(childProcess.execFileSync).toHaveBeenCalledWith(
      'xmllint',
      ['--noout', '--schema', SCHEMA_PATH, '/tmp/ksef-xsd-mock/invoice.xml'],
      expect.objectContaining({ encoding: 'utf-8' }),
    );
  });

  it('throws XsdValidationError with parsed details on validation failure', () => {
    const xmllintError = Object.assign(new Error('xmllint failed'), {
      status: 3,
      stderr: [
        '/tmp/ksef-xsd-mock/invoice.xml:5: element Kwota: Schemas validity error : Element \'Kwota\': \'abc\' is not a valid value',
        '/tmp/ksef-xsd-mock/invoice.xml:10: element NIP: Schemas validity error : Element \'NIP\': Missing child element',
        '/tmp/ksef-xsd-mock/invoice.xml fails to validate',
      ].join('\n'),
    });

    vi.mocked(childProcess.execFileSync).mockImplementation(() => {
      throw xmllintError;
    });

    try {
      validateXmlAgainstXsd(SAMPLE_XML, SCHEMA_PATH);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(XsdValidationError);
      const xsdError = error as XsdValidationError;
      expect(xsdError.details).toHaveLength(2);
      expect(xsdError.details[0].line).toBe(5);
      expect(xsdError.details[0].message).toContain('Kwota');
      expect(xsdError.details[1].line).toBe(10);
      expect(xsdError.details[1].message).toContain('NIP');
    }
  });

  it('throws XsdValidationError with empty details for unparseable stderr', () => {
    const xmllintError = Object.assign(new Error('xmllint failed'), {
      status: 4,
      stderr: 'some unexpected error output',
    });

    vi.mocked(childProcess.execFileSync).mockImplementation(() => {
      throw xmllintError;
    });

    expect(() => validateXmlAgainstXsd(SAMPLE_XML, SCHEMA_PATH)).toThrow(
      XsdValidationError,
    );
  });
});

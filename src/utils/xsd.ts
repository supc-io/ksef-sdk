import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigurationError, XsdValidationError } from '../errors/index.js';
import type { XsdValidationDetail } from '../errors/index.js';

/**
 * xmllint exit codes (see `man xmllint`).
 * 1 = unclassified (e.g. XML not well-formed), 3/4 = validation error,
 * 5 = error in schema compilation (missing or invalid XSD).
 */
const XMLLINT_SCHEMA_ERROR = 5;

/**
 * Validates an XML string against an XSD schema using xmllint CLI.
 *
 * @param xml - XML string to validate
 * @param xsdPath - Absolute path to the XSD schema file
 * @throws XsdValidationError if the XML does not conform to the schema (or is not well-formed)
 * @throws ConfigurationError if xmllint is not installed or the XSD file cannot be loaded
 */
export function validateXmlAgainstXsd(xml: string, xsdPath: string): void {
  const tempDir = mkdtempSync(join(tmpdir(), 'ksef-xsd-'));
  const xmlPath = join(tempDir, 'invoice.xml');

  try {
    writeFileSync(xmlPath, xml, 'utf-8');

    execFileSync('xmllint', ['--noout', '--schema', xsdPath, xmlPath], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException & {
      status?: number | null;
      stderr?: string | Buffer;
    };

    if (err.code === 'ENOENT') {
      throw new ConfigurationError(
        'xmllint CLI not found in PATH. Install libxml2-utils (Debian/Ubuntu) or libxml2 (macOS, Homebrew), or disable XML validation.',
      );
    }

    if (err.status === null || err.status === undefined) {
      // Not an xmllint exit status (e.g. writeFileSync failure) — propagate as-is.
      throw error;
    }

    const stderr = String(err.stderr ?? '');

    if (err.status === XMLLINT_SCHEMA_ERROR) {
      throw new ConfigurationError(
        `XSD schema could not be loaded from ${xsdPath}: ${stderr.trim() || 'unknown error'}`,
      );
    }

    const details = parseXmllintErrors(stderr);

    if (details.length > 0) {
      throw new XsdValidationError(
        `Invoice XML does not conform to XSD schema: ${details.length} error(s) found`,
        details,
      );
    }

    throw new XsdValidationError(`XSD validation failed: ${stderr.trim() || 'unknown error'}`, []);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Parses xmllint stderr output into structured validation details.
 *
 * xmllint error format:
 *   /path/to/file.xml:10: element Foo: Schemas validity error : ...
 */
function parseXmllintErrors(stderr: string): XsdValidationDetail[] {
  const details: XsdValidationDetail[] = [];
  const lines = stderr.split('\n');

  for (const line of lines) {
    // Match: filename:line: ... : message
    const match = line.match(/^.+?:(\d+):\s*(.+)$/);
    if (match) {
      const message = match[2].trim();
      // Skip the "validates" / "fails to validate" summary line
      if (message.includes('fails to validate') || message.includes('validates')) {
        continue;
      }
      details.push({
        line: parseInt(match[1], 10),
        message,
      });
    }
  }

  return details;
}

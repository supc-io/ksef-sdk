import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { XsdValidationError } from '../errors/index.js';
import type { XsdValidationDetail } from '../errors/index.js';

/**
 * Validates an XML string against an XSD schema using xmllint CLI.
 * Throws XsdValidationError if the XML does not conform to the schema.
 *
 * @param xml - XML string to validate
 * @param xsdPath - Absolute path to the XSD schema file
 */
export function validateXmlAgainstXsd(xml: string, xsdPath: string): void {
  const tempDir = mkdtempSync(join(tmpdir(), 'ksef-xsd-'));
  const xmlPath = join(tempDir, 'invoice.xml');

  try {
    writeFileSync(xmlPath, xml, 'utf-8');

    execFileSync('xmllint', ['--noout', '--schema', xsdPath, xmlPath], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error: unknown) {
    const stderr = (error as { stderr?: string }).stderr ?? '';
    const status = (error as { status?: number }).status;

    // xmllint returns exit code 3 or 4 for validation errors, other codes for other issues
    if (status !== null && status !== undefined && status !== 0) {
      const details = parseXmllintErrors(stderr);

      if (details.length > 0) {
        throw new XsdValidationError(
          `Invoice XML does not conform to XSD schema: ${details.length} error(s) found`,
          details,
        );
      }

      // xmllint not found or other system error
      if (stderr.includes('command not found') || stderr.includes('not recognized')) {
        throw new Error(
          'xmllint is not installed. Install libxml2-utils (Linux) or libxml2 (macOS) to enable XSD validation.',
        );
      }

      throw new XsdValidationError(
        `XSD validation failed: ${stderr.trim() || 'unknown error'}`,
        [],
      );
    }
  } finally {
    try { unlinkSync(xmlPath); } catch { /* ignore */ }
    try { unlinkSync(tempDir); } catch { /* ignore */ }
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

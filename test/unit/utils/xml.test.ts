import { describe, it, expect } from 'vitest';
import { parseXml, buildXml } from '../../../src/utils/xml.js';

describe('parseXml', () => {
  it('parses simple XML', () => {
    const xml = '<root><name>test</name><value>42</value></root>';
    const result = parseXml(xml);
    expect(result).toEqual({
      root: { name: 'test', value: 42 },
    });
  });

  it('parses XML with attributes', () => {
    const xml = '<root type="test"><child id="1">value</child></root>';
    const result = parseXml(xml);
    expect(result).toEqual({
      root: {
        '@_type': 'test',
        child: {
          '@_id': '1',
          '#text': 'value',
        },
      },
    });
  });
});

describe('buildXml', () => {
  it('builds simple XML', () => {
    const obj = { root: { name: 'test', value: '42' } };
    const xml = buildXml(obj);
    expect(xml).toContain('<root>');
    expect(xml).toContain('<name>test</name>');
    expect(xml).toContain('<value>42</value>');
    expect(xml).toContain('</root>');
  });

  it('builds XML with attributes', () => {
    const obj = { root: { '@_type': 'test', child: 'value' } };
    const xml = buildXml(obj);
    expect(xml).toContain('type="test"');
    expect(xml).toContain('<child>value</child>');
  });
});

import { XMLParser, XMLBuilder } from 'fast-xml-parser';

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
  trimValues: true,
  isArray: (_name: string, _jpath: string) => false,
};

const builderOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  format: true,
  suppressEmptyNode: true,
};

const parser = new XMLParser(parserOptions);
const builder = new XMLBuilder(builderOptions);

export function parseXml<T = Record<string, unknown>>(xml: string): T {
  return parser.parse(xml) as T;
}

export function buildXml(obj: Record<string, unknown>): string {
  return builder.build(obj) as string;
}

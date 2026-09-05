import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { DefaultHttpClient } from '../../../src/http/default-http-client.js';
import { ConnectionError } from '../../../src/errors/index.js';

const BINARY = Buffer.from([0xff, 0xfe, 0x00, 0x80, 0x41]);

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      switch (req.url) {
        case '/binary':
          res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'X-Test': 'Value' });
          res.end(BINARY);
          return;
        case '/echo':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              method: req.method,
              contentType: req.headers['content-type'] ?? null,
              body: body.toString('base64'),
            }),
          );
          return;
        case '/slow':
          setTimeout(() => {
            res.writeHead(200);
            res.end('late');
          }, 400);
          return;
        default:
          res.writeHead(404);
          res.end();
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('DefaultHttpClient', () => {
  const client = new DefaultHttpClient();

  it('returns raw bytes untouched and lower-cases header names', async () => {
    const response = await client.request({ method: 'GET', url: `${baseUrl}/binary` });

    expect(response.status).toBe(200);
    expect(response.rawBody).toEqual(BINARY);
    expect(response.headers['x-test']).toBe('Value');
    // the text view is lossy for non-UTF-8 bytes, but the raw view is not
    expect(Buffer.from(response.body, 'utf-8')).not.toEqual(BINARY);
  });

  it('sends string and Buffer bodies with headers', async () => {
    const asString = await client.request({
      method: 'POST',
      url: `${baseUrl}/echo`,
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":1}',
    });
    expect(JSON.parse(asString.body)).toEqual({
      method: 'POST',
      contentType: 'application/json',
      body: Buffer.from('{"a":1}').toString('base64'),
    });

    const asBuffer = await client.request({
      method: 'PUT',
      url: `${baseUrl}/echo`,
      body: BINARY,
    });
    expect(JSON.parse(asBuffer.body).body).toBe(BINARY.toString('base64'));
  });

  it('throws a timeout ConnectionError when the server is too slow', async () => {
    await expect(
      client.request({ method: 'GET', url: `${baseUrl}/slow`, timeout: 50 }),
    ).rejects.toThrow(/timed out after 50ms/);
  });

  it('reports a caller abort distinctly from a timeout', async () => {
    const controller = new AbortController();
    const pending = client.request({
      method: 'GET',
      url: `${baseUrl}/slow`,
      timeout: 5000,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 20);

    await expect(pending).rejects.toThrow(/aborted by caller/);
  });

  it('rejects an already-aborted signal without sending the request', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      client.request({ method: 'GET', url: `${baseUrl}/echo`, signal: controller.signal }),
    ).rejects.toThrow(/aborted by caller/);
  });

  it('wraps socket errors in ConnectionError with the error code', async () => {
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
    const port = (closed.address() as AddressInfo).port;
    await new Promise<void>((resolve) => closed.close(() => resolve()));

    const error = await client
      .request({ method: 'GET', url: `http://127.0.0.1:${port}/` })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConnectionError);
    expect((error as Error).message).toMatch(/Network error/);
    expect((error as Error).message).toMatch(/ECONNREFUSED/);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from './errors';
import { fetchJson } from './http';

const isRequestLike = (input: unknown): input is { url: string } => {
  if (!input || typeof input !== 'object') {
    return false;
  }
  if (!('url' in input)) {
    return false;
  }
  return typeof (input as { url?: unknown }).url === 'string';
};

const getRequestUrl = (input: unknown): string => {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if (isRequestLike(input)) {
    return input.url;
  }
  return '';
};

describe('fetchJson', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies query params and JSON body', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementationOnce((input, init) => {
      const requestUrl = getRequestUrl(input);
      expect(requestUrl).toContain('foo=bar');
      expect(init?.method).toBe('POST');
      expect(init?.body).toBe(JSON.stringify({ test: 1 }));
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
    });

    const result = await fetchJson({
      url: 'https://example.com',
      method: 'POST',
      query: { foo: 'bar' },
      body: { test: 1 },
    });

    expect(result).toEqual({ ok: true });
  });

  it('throws HttpError for non-OK responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response('Nope', { status: 500 }));

    await expect(
      fetchJson({ url: 'https://example.com' })
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('returns null for empty responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }));

    const result = await fetchJson({ url: 'https://example.com' });
    expect(result).toBeNull();
  });

  it('skips undefined query values', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementationOnce((input) => {
      const requestUrl = getRequestUrl(input);
      expect(requestUrl).toContain('bar=baz');
      expect(requestUrl).not.toContain('foo=');
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
    });

    const result = await fetchJson({
      url: 'https://example.com',
      query: { foo: undefined, bar: 'baz' },
    });

    expect(result).toEqual({ ok: true });
  });

  it('accepts provided abort signals', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const controller = new AbortController();
    const result = await fetchJson({
      url: 'https://example.com',
      signal: controller.signal,
    });

    expect(result).toEqual({ ok: true });
  });

  it('handles already-aborted signals', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const controller = new AbortController();
    controller.abort();

    const result = await fetchJson({
      url: 'https://example.com',
      signal: controller.signal,
    });

    expect(result).toEqual({ ok: true });
  });
});

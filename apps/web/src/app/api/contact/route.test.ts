import { describe, expect, it, vi, beforeEach } from 'vitest';

import { POST } from './route';

// Mock fetch for Resend API calls
const fetchSpy = vi.spyOn(globalThis, 'fetch');

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    fetchSpy.mockReset();
  });

  it('returns 400 when message is missing', async () => {
    const res = await POST(makeRequest({ category: 'feedback' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/at least 10 characters/i);
  });

  it('returns 400 when message is too short', async () => {
    const res = await POST(
      makeRequest({ category: 'feedback', message: 'hi' })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/at least 10 characters/i);
  });

  it('returns 400 when message exceeds 2000 characters', async () => {
    const res = await POST(
      makeRequest({ category: 'feedback', message: 'x'.repeat(2001) })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/under 2000/i);
  });

  it('returns 400 for invalid category', async () => {
    const res = await POST(
      makeRequest({
        category: 'hacking',
        message: 'This is a valid message body',
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid category/i);
  });

  it('returns 400 for malformed JSON', async () => {
    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('succeeds with valid feedback (no RESEND_API_KEY)', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const res = await POST(
      makeRequest({
        name: 'TestUser',
        email: 'test@example.com',
        category: 'feedback',
        subject: 'Great site',
        message: 'This is really helpful for my OSRS adventures!',
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // Should log to console when no API key
    expect(consoleSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('RESEND_API_KEY not set')
    );

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('succeeds with minimal required fields', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const res = await POST(
      makeRequest({
        category: 'suggestion',
        message: 'Add more calculators please!',
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    consoleSpy.mockRestore();
  });

  it('accepts all valid categories', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (const category of [
      'feedback',
      'suggestion',
      'bug',
      'question',
      'other',
    ]) {
      const res = await POST(
        makeRequest({
          category,
          message: 'A valid message that is long enough',
        })
      );
      expect(res.status).toBe(200);
    }
  });
});

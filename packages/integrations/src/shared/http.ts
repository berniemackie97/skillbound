import { HttpError } from './errors';

export type FetchJsonOptions = {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function fetchJson<T = unknown>(
  options: FetchJsonOptions
): Promise<T> {
  const url = new URL(options.url);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined || value === null) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 10_000
  );

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', () => controller.abort(), {
        once: true,
      });
    }
  }

  const headers = new Headers({
    accept: 'application/json',
    ...options.headers,
  });

  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(options.body);
  }

  try {
    const requestInit: RequestInit = {
      method: options.method ?? 'GET',
      headers,
      signal: controller.signal,
    };
    if (body !== undefined) {
      requestInit.body = body;
    }

    const response = await fetch(url, requestInit);

    const text = await response.text();

    if (!response.ok) {
      throw new HttpError(
        `Request failed with status ${response.status}`,
        response.status,
        text || null
      );
    }

    if (!text) {
      return null as T;
    }

    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timeout);
  }
}

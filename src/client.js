import { GetTempError, asGetTempError } from './errors.js';

export const DEFAULT_API_ORIGIN = 'https://api.gettemp.email';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function validOrigin(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/')
    throw new GetTempError('invalid_input', 'apiOrigin must contain only a secure origin.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '::1'].includes(hostname))
    throw new GetTempError('invalid_input', 'apiOrigin must use HTTPS.');
  return url.origin;
}

function accessToken(inbox) {
  const token = inbox?.accessToken;
  if (!token) throw new GetTempError('inbox_capability_required', 'Inbox access token is required.');
  return token;
}

function inboxId(inbox) {
  const id = inbox?.inboxId;
  if (!id) throw new GetTempError('invalid_input', 'Inbox ID is required.');
  return id;
}

export class GetTempClient {
  constructor(options = {}) {
    const apiKey = options.apiKey ?? process.env.GETTEMP_API_KEY;
    if (!apiKey)
      throw new GetTempError('authentication_required', 'Set GETTEMP_API_KEY or pass apiKey.');
    this.apiKey = apiKey;
    this.apiOrigin = validOrigin(options.apiOrigin ?? DEFAULT_API_ORIGIN);
    this.fetch = options.fetch ?? globalThis.fetch;
    if (typeof this.fetch !== 'function')
      throw new GetTempError('invalid_input', 'A Fetch API implementation is required.');
  }

  async request(path, options = {}) {
    const headers = new Headers(options.headers);
    headers.set('authorization', `Bearer ${this.apiKey}`);
    if (options.body !== undefined) headers.set('content-type', 'application/json');

    let response;
    try {
      response = await this.fetch(`${this.apiOrigin}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      });
    } catch (error) {
      throw asGetTempError(error);
    }

    if (options.expected?.includes(response.status)) {
      if (response.status === 204) return null;
      return response.json();
    }

    let code = 'request_failed';
    try {
      const body = await response.json();
      if (typeof body?.error === 'string' && /^[a-z][a-z0-9_]{1,63}$/.test(body.error))
        code = body.error;
    } catch {
      // Never include an upstream body in errors: it may contain sensitive mail data.
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    throw new GetTempError(code, `gettemp.email returned HTTP ${response.status}.`, {
      status: response.status,
      retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : null,
    });
  }

  status(options = {}) {
    return this.request('/v1/developer/status', { expected: [200], signal: options.signal });
  }

  createInbox(options = {}) {
    const ttlMinutes = options.ttlMinutes ?? 60;
    if (!Number.isInteger(ttlMinutes) || ttlMinutes < 5 || ttlMinutes > 1440)
      throw new GetTempError('invalid_input', 'ttlMinutes must be an integer from 5 to 1440.');
    return this.request('/v1/developer/inboxes', {
      method: 'POST',
      body: { ttlMinutes },
      expected: [201],
      signal: options.signal,
    });
  }

  listMessages(inbox, options = {}) {
    return this.request(`/v1/developer/inboxes/${encodeURIComponent(inboxId(inbox))}/messages`, {
      headers: { 'x-inbox-access-token': accessToken(inbox) },
      expected: [200],
      signal: options.signal,
    });
  }

  readMessage(inbox, messageId, options = {}) {
    if (!messageId) throw new GetTempError('invalid_input', 'messageId is required.');
    return this.request(
      `/v1/developer/inboxes/${encodeURIComponent(inboxId(inbox))}/messages/${encodeURIComponent(messageId)}`,
      {
        headers: { 'x-inbox-access-token': accessToken(inbox) },
        expected: [200],
        signal: options.signal,
      },
    );
  }

  async waitForMessage(inbox, options = {}) {
    const timeoutMs = options.timeoutMs ?? 45_000;
    const intervalMs = options.intervalMs ?? 1_000;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const messages = await this.listMessages(inbox, { signal: options.signal });
      const match = messages.find((message) => {
        if (options.subjectIncludes && !message.subject?.includes(options.subjectIncludes))
          return false;
        if (options.senderIncludes && !message.sender_label?.includes(options.senderIncludes))
          return false;
        return true;
      });
      if (match) return match;
      await sleep(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
    }
    throw new GetTempError('message_timeout', 'No matching message arrived before the deadline.');
  }

  async deleteInbox(inbox, options = {}) {
    try {
      await this.request(`/v1/developer/inboxes/${encodeURIComponent(inboxId(inbox))}`, {
        method: 'DELETE',
        headers: { 'x-inbox-access-token': accessToken(inbox) },
        expected: [204],
        signal: options.signal,
      });
      return { deleted: true };
    } catch (error) {
      if (error?.status === 404) return { deleted: false };
      throw error;
    }
  }

  async withInbox(callback, options = {}) {
    const inbox = await this.createInbox(options);
    try {
      return await callback(inbox, this);
    } finally {
      await this.deleteInbox(inbox, options);
    }
  }

  async doctor(options = {}) {
    const status = await this.status(options);
    if (options.statusOnly) return { ok: true, status: 'authenticated', plan: status.plan };
    const inbox = await this.createInbox({ ttlMinutes: 5, signal: options.signal });
    try {
      return { ok: true, status: 'create_delete_passed', plan: status.plan };
    } finally {
      await this.deleteInbox(inbox, options);
    }
  }
}

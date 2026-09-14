import { GetTempClient } from './client.js';
import { otp, verificationUrl } from './helpers.js';

export function createPlaywrightInbox(request, options = {}) {
  const client = new GetTempClient({
    apiKey: options.apiKey,
    apiOrigin: options.apiOrigin,
    fetch: async (url, init = {}) => {
      init.signal?.throwIfAborted();
      const readResponse = async () => {
        const response = await request.fetch(url, {
          method: init.method,
          headers: Object.fromEntries(new Headers(init.headers).entries()),
          data: init.body ? JSON.parse(init.body) : undefined,
          failOnStatusCode: false,
          timeout: 5_000,
        });
        try {
          init.signal?.throwIfAborted();
          const status = response.status();
          const body = [204, 205, 304].includes(status) ? null : await response.body();
          return new Response(body, { status, headers: response.headers() });
        } finally {
          await response.dispose?.();
        }
      };
      if (!init.signal) return readResponse();
      let onAbort;
      const aborted = new Promise((_, reject) => {
        onAbort = () => reject(init.signal.reason);
        init.signal.addEventListener('abort', onAbort, { once: true });
      });
      try {
        // APIRequestContext has no per-request AbortSignal. Stop waiting promptly;
        // its own timeout bounds the remaining request and readResponse disposes it.
        return await Promise.race([readResponse(), aborted]);
      } finally {
        init.signal.removeEventListener('abort', onAbort);
      }
    },
  });
  return {
    client,
    verificationUrl,
    otp,
    async use(callback, inboxOptions = {}) {
      return client.withInbox(callback, inboxOptions);
    },
  };
}

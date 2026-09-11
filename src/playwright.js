import { GetTempClient } from './client.js';
import { otp, verificationUrl } from './helpers.js';

export function createPlaywrightInbox(request, options = {}) {
  const client = new GetTempClient({
    apiKey: options.apiKey,
    apiOrigin: options.apiOrigin,
    fetch: async (url, init = {}) => {
      const response = await request.fetch(url, {
        method: init.method,
        headers: Object.fromEntries(new Headers(init.headers).entries()),
        data: init.body ? JSON.parse(init.body) : undefined,
        failOnStatusCode: false,
      });
      return new Response(response.body(), {
        status: response.status(),
        headers: response.headers(),
      });
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

export class GetTempError extends Error {
  constructor(category, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'GetTempError';
    this.category = category;
    this.status = options.status ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

export function asGetTempError(error, category = 'network_error') {
  if (error instanceof GetTempError) return error;
  return new GetTempError(category, 'The gettemp.email request could not be completed.', {
    cause: error,
  });
}

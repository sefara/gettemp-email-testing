import { GetTempError } from './errors.js';

const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);

function normalizedHost(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

export function exactHostUrl(href, options = {}) {
  const expectedHostname = normalizedHost(options.expectedHostname);
  if (!expectedHostname) throw new GetTempError('invalid_input', 'expectedHostname is required.');

  let url;
  try {
    url = new URL(href);
  } catch {
    throw new GetTempError('invalid_verification_url', 'The candidate is not a valid URL.');
  }

  const actualHostname = normalizedHost(url.hostname);
  if (url.username || url.password)
    throw new GetTempError(
      'unsafe_verification_url',
      'Verification links cannot contain credentials.',
    );
  const isAllowedLocalHttp = url.protocol === 'http:' && localHosts.has(actualHostname);
  if (url.protocol !== 'https:' && !isAllowedLocalHttp)
    throw new GetTempError(
      'unsafe_verification_url',
      'Verification links must use HTTPS, except localhost development URLs.',
    );
  if (actualHostname !== expectedHostname)
    throw new GetTempError('unexpected_hostname', 'Verification link hostname did not match.');

  if (options.expectedPath) {
    const allowed = Array.isArray(options.expectedPath)
      ? options.expectedPath
      : [options.expectedPath];
    if (!allowed.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`)))
      throw new GetTempError('unexpected_path', 'Verification link path did not match.');
  }
  return url.href;
}

export function verificationUrl(message, options = {}) {
  const candidates = Array.isArray(message?.safe_links) ? message.safe_links : [];
  const verified = [];
  for (const candidate of candidates) {
    if (candidate?.classification !== 'verification-likely') continue;
    try {
      verified.push(exactHostUrl(candidate.href, options));
    } catch (error) {
      if (error?.category === 'unexpected_hostname' || error?.category === 'unexpected_path')
        continue;
      if (error?.category === 'unsafe_verification_url') continue;
      if (error?.category === 'invalid_verification_url') continue;
      throw error;
    }
  }
  const unique = [...new Set(verified)];
  if (unique.length === 0)
    throw new GetTempError('verification_link_not_found', 'No safe verification link matched.');
  if (unique.length > 1)
    throw new GetTempError(
      'ambiguous_verification_link',
      'More than one verification link matched; select one explicitly.',
    );
  return unique[0];
}

export function otp(message, options = {}) {
  const expectedLength = options.expectedLength;
  const values = (Array.isArray(message?.otp_candidates) ? message.otp_candidates : [])
    .map((candidate) => String(candidate?.value ?? '').trim())
    .filter((value) => value && (!expectedLength || value.length === expectedLength));
  const unique = [...new Set(values)];
  if (unique.length === 0) throw new GetTempError('otp_not_found', 'No OTP candidate matched.');
  if (unique.length > 1)
    throw new GetTempError('ambiguous_otp', 'More than one OTP candidate matched.');
  return unique[0];
}

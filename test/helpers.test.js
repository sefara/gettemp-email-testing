import assert from 'node:assert/strict';
import test from 'node:test';
import { exactHostUrl, otp, verificationUrl } from '../src/helpers.js';

test('exactHostUrl accepts HTTPS on the exact hostname', () => {
  assert.equal(
    exactHostUrl('https://accounts.example.test/verify?id=1', {
      expectedHostname: 'accounts.example.test',
      expectedPath: '/verify',
    }),
    'https://accounts.example.test/verify?id=1',
  );
});

test('exactHostUrl rejects lookalike, subdomain and insecure URLs', () => {
  for (const href of [
    'https://accounts.example.test.evil.test/verify',
    'https://sub.accounts.example.test/verify',
    'http://accounts.example.test/verify',
  ]) {
    assert.throws(() => exactHostUrl(href, { expectedHostname: 'accounts.example.test' }));
  }
});

test('localhost HTTP is allowed only when it is the exact expected host', () => {
  assert.equal(
    exactHostUrl('http://127.0.0.1:3000/verify', {
      expectedHostname: '127.0.0.1',
    }),
    'http://127.0.0.1:3000/verify',
  );
  assert.throws(() =>
    exactHostUrl('http://127.0.0.1:3000/verify', {
      expectedHostname: 'localhost',
    }),
  );
});

test('IPv6 loopback HTTP accepts normalized exact host only', () => {
  assert.equal(
    exactHostUrl('http://[::1]:3000/verify', { expectedHostname: '::1' }),
    'http://[::1]:3000/verify',
  );
});

test('verificationUrl returns one classified, exact-host link', () => {
  assert.equal(
    verificationUrl(
      {
        safe_links: [
          {
            classification: 'verification-likely',
            href: 'https://evil.test/verify',
          },
          {
            classification: 'verification-likely',
            href: 'https://accounts.example.test/verify',
          },
        ],
      },
      { expectedHostname: 'accounts.example.test' },
    ),
    'https://accounts.example.test/verify',
  );
});

test('verificationUrl and otp fail closed on ambiguity', () => {
  assert.throws(
    () =>
      verificationUrl(
        {
          safe_links: [
            {
              classification: 'verification-likely',
              href: 'https://example.test/a',
            },
            {
              classification: 'verification-likely',
              href: 'https://example.test/b',
            },
          ],
        },
        { expectedHostname: 'example.test' },
      ),
    { category: 'ambiguous_verification_link' },
  );
  assert.throws(() => otp({ otp_candidates: [{ value: '123456' }, { value: '654321' }] }), {
    category: 'ambiguous_otp',
  });
});

test('otp supports an exact length constraint', () => {
  assert.equal(
    otp({ otp_candidates: [{ value: '1234' }, { value: '123456' }] }, { expectedLength: 6 }),
    '123456',
  );
});

test('verification helpers reject embedded credentials and preserve invalid-input errors', () => {
  assert.throws(
    () =>
      exactHostUrl('https://user:password@example.test/verify', {
        expectedHostname: 'example.test',
      }),
    { category: 'unsafe_verification_url' },
  );
  assert.throws(
    () =>
      verificationUrl({
        safe_links: [
          {
            classification: 'verification-likely',
            href: 'https://example.test/verify',
          },
        ],
      }),
    { category: 'invalid_input' },
  );
});

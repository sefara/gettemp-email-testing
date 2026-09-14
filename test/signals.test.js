import assert from 'node:assert/strict';
import test from 'node:test';
import { getEventListeners } from 'node:events';
import { anySignal } from '../src/signals.js';

test('signal combination still works on Node 20 without AbortSignal.any', () => {
  const original = AbortSignal.any;
  try {
    AbortSignal.any = undefined;
    const one = new AbortController();
    const two = new AbortController();
    const combined = anySignal([one.signal, undefined, two.signal]);
    two.abort('synthetic-abort');
    assert.equal(combined.aborted, true);
    assert.equal(combined.reason, 'synthetic-abort');
    assert.equal(getEventListeners(one.signal, 'abort').length, 0);
    assert.equal(getEventListeners(two.signal, 'abort').length, 0);
    assert.equal(anySignal([two.signal]).aborted, true);
  } finally { AbortSignal.any = original; }
});

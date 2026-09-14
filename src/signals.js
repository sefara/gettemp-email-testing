// Preserve the package's Node >=20 contract; AbortSignal.any arrived in Node 20.3.
export function anySignal(signals) {
  const inputs = signals.filter(Boolean);
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(inputs);
  const controller = new AbortController();
  const listeners = new Map();
  const abort = (signal) => {
    for (const [input, listener] of listeners) input.removeEventListener('abort', listener);
    controller.abort(signal.reason);
  };
  for (const signal of inputs) {
    if (signal.aborted) { abort(signal); break; }
    const listener = () => abort(signal);
    listeners.set(signal, listener);
    signal.addEventListener('abort', listener, { once: true });
  }
  return controller.signal;
}

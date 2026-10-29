'use client';

export function ClientEnvDisplay() {
  // INTERNAL_CONFIG is NOT prefixed with NEXT_PUBLIC_, so it must never be
  // exposed to the browser. In the browser this evaluates to `undefined`.
  // But this Client Component is ALSO prerendered on the server, where
  // process.env.INTERNAL_CONFIG resolves to the real secret and is baked
  // into the HTML sent to the browser.
  return (
    <p>
      Server-only env var value: {process.env.INTERNAL_CONFIG || 'undefined'}
    </p>
  );
}

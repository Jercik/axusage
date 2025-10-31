/**
 * Mock fetch implementation for testing
 * @internal - Only used by withMockFetch below
 */
function createMockFetch(
  responseBody: unknown,
  status = 200,
  statusText = "OK",
): typeof fetch {
  return () => {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText,
      json: () => Promise.resolve(responseBody),
      text: () => Promise.resolve(JSON.stringify(responseBody)),
    } as Response);
  };
}

/**
 * Replace global fetch with mock and restore after test
 */
export function withMockFetch<T>(
  responseBody: unknown,
  testFunction: () => Promise<T>,
  status = 200,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch(responseBody, status);

  return testFunction().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

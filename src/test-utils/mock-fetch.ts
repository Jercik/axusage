/**
 * Mock fetch implementation for testing
 */
export function createMockFetch(
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
  testFn: () => Promise<T>,
  status = 200,
): Promise<T> {
  const originalFetch = global.fetch;
  global.fetch = createMockFetch(responseBody, status);

  return testFn().finally(() => {
    global.fetch = originalFetch;
  });
}

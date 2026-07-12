// Shared helper so every route handles a malformed/empty JSON body the same
// way — returns null instead of throwing, so callers can return a clean 400
// instead of an unhandled 500.
export async function parseJsonBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

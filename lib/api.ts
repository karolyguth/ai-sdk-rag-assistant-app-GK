export const ALLOWED_EXTENSIONS = ['.md', '.txt'];
export const MAX_FILE_BYTES = 1_000_000;

export function jsonError(status: number, error: string) {
  return Response.json({ error }, { status });
}

export function serverError(context: string, e: unknown) {
  console.error(`[api] ${context} failed:`, e);
  return jsonError(500, `${context} failed. Please try again later.`);
}

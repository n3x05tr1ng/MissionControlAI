import "server-only";

export function apiError(message: string, status = 500): Response {
  return Response.json({ error: message }, { status });
}

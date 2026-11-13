import { z } from 'zod';

import {
  DocumentBusyError,
  DocumentNotFoundError,
  processDocument,
} from '@/lib/documents';
import { jsonError, serverError } from '@/lib/api';

export const maxDuration = 60;

const bodySchema = z.object({
  id: z.string().trim().min(1).max(191),
});

// POST /api/process { id } – chunkolás és embedding, újrafuttatható
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Expected a JSON body: { "id": "<document id>" }.');
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, 'Expected a JSON body: { "id": "<document id>" }.');
  }

  try {
    const result = await processDocument(parsed.data.id);
    return Response.json(result);
  } catch (e) {
    if (e instanceof DocumentNotFoundError) return jsonError(404, e.message);
    if (e instanceof DocumentBusyError) return jsonError(409, e.message);
    return serverError('Processing', e);
  }
}

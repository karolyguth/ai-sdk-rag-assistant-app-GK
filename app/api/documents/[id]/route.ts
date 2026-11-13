import { deleteDocument } from '@/lib/documents';
import { jsonError, serverError } from '@/lib/api';

// DELETE /api/documents/:id – a chunkok is törlődnek (ON DELETE CASCADE)
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = params.id?.trim();
  if (!id || id.length > 191) {
    return jsonError(400, 'Invalid document id.');
  }

  try {
    const deleted = await deleteDocument(id);
    if (!deleted) return jsonError(404, `Document not found: ${id}`);
    return Response.json({ id, deleted: true });
  } catch (e) {
    return serverError('Deleting document', e);
  }
}

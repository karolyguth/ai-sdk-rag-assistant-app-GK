import { listDocuments } from '@/lib/documents';
import { serverError } from '@/lib/api';

// Enélkül a Next.js 14 buildkor cache-elné a GET választ, és a lista nem frissülne
export const dynamic = 'force-dynamic';

// GET /api/documents – dokumentumlista a teljes szöveg nélkül
export async function GET() {
  try {
    const documents = await listDocuments();
    return Response.json({ documents });
  } catch (e) {
    return serverError('Listing documents', e);
  }
}

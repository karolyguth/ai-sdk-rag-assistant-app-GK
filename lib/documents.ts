import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  embeddings,
  resources,
  ResourceSource,
} from '@/lib/db/schema/resources';
import { generateEmbeddings } from '@/lib/ai/embedding';
import { extractTitle } from '@/lib/ai/chunking';
import { extractRecipeMetadata } from '@/lib/ai/recipe-metadata';

// Service réteg: ezt használja az API, a seed script és a chat tool is

export class DocumentNotFoundError extends Error {
  constructor(id: string) {
    super(`Document not found: ${id}`);
    this.name = 'DocumentNotFoundError';
  }
}

export class DocumentBusyError extends Error {
  constructor(id: string) {
    super(`Document is already being processed: ${id}`);
    this.name = 'DocumentBusyError';
  }
}

// Ennél régebbi 'processing' állapot (pl. összeomlás után) újra feldolgozható
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

export type CreateDocumentInput = {
  content: string;
  fileName?: string;
  source?: ResourceSource;
  title?: string;
};

export async function findUploadByFileName(fileName: string) {
  const [row] = await db
    .select({ id: resources.id, status: resources.status })
    .from(resources)
    .where(and(eq(resources.fileName, fileName), eq(resources.source, 'upload')))
    .limit(1);
  return row ?? null;
}

export async function createDocument(input: CreateDocumentInput) {
  const isMarkdown = input.fileName ? /\.md$/i.test(input.fileName) : false;
  const recipe = isMarkdown ? extractRecipeMetadata(input.content, input.fileName) : null;

  const [row] = await db
    .insert(resources)
    .values({
      content: input.content,
      fileName: input.fileName,
      source: input.source ?? 'upload',
      status: 'uploaded',
      title: input.title ?? extractTitle(input.content, input.fileName),
      metadata: recipe?.isRecipe ? recipe : null,
    })
    .returning({
      id: resources.id,
      fileName: resources.fileName,
      title: resources.title,
      source: resources.source,
      status: resources.status,
    });
  return row;
}

// Újrafuttatható: a régi chunkok lecserélődnek
export async function processDocument(id: string) {
  const [doc] = await db.select().from(resources).where(eq(resources.id, id));
  if (!doc) throw new DocumentNotFoundError(id);
  if (
    doc.status === 'processing' &&
    Date.now() - doc.updatedAt.getTime() < PROCESSING_TIMEOUT_MS
  ) {
    throw new DocumentBusyError(id);
  }

  await setStatus(id, 'processing', null);
  try {
    // Az OpenAI hívás a tranzakción kívül van, hogy ne tartsa zárolva az adatbázist
    const chunks = await generateEmbeddings(doc.content, doc.fileName ?? undefined);

    await db.transaction(async tx => {
      await tx.delete(embeddings).where(eq(embeddings.resourceId, id));
      await tx.insert(embeddings).values(
        chunks.map(chunk => ({
          resourceId: id,
          content: chunk.content,
          embedding: chunk.embedding,
        })),
      );
      await tx
        .update(resources)
        .set({ status: 'processed', error: null, updatedAt: new Date() })
        .where(eq(resources.id, id));
    });

    console.info(`[documents] processed ${id} (${doc.fileName ?? doc.source}): ${chunks.length} chunk(s)`);
    return { id, status: 'processed' as const, chunkCount: chunks.length };
  } catch (e) {
    const message = e instanceof Error && e.message ? e.message : 'Unknown processing error';
    console.error(`[documents] processing failed for ${id}:`, e);
    await setStatus(id, 'failed', message).catch(() => {});
    throw e;
  }
}

export async function listDocuments() {
  return db
    .select({
      id: resources.id,
      fileName: resources.fileName,
      title: resources.title,
      source: resources.source,
      status: resources.status,
      error: resources.error,
      metadata: resources.metadata,
      chunkCount: sql<number>`cast(count(${embeddings.id}) as int)`,
      createdAt: resources.createdAt,
      updatedAt: resources.updatedAt,
    })
    .from(resources)
    .leftJoin(embeddings, eq(embeddings.resourceId, resources.id))
    .groupBy(resources.id)
    .orderBy(desc(resources.createdAt));
}

export async function deleteDocument(id: string): Promise<boolean> {
  const deleted = await db
    .delete(resources)
    .where(eq(resources.id, id))
    .returning({ id: resources.id });
  if (deleted.length > 0) console.info(`[documents] deleted ${id}`);
  return deleted.length > 0;
}

async function setStatus(
  id: string,
  status: 'processing' | 'failed',
  error: string | null,
) {
  await db
    .update(resources)
    .set({ status, error, updatedAt: new Date() })
    .where(eq(resources.id, id));
}

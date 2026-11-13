'use server';

import { eq } from 'drizzle-orm';
import {
  NewResourceParams,
  insertResourceSchema,
  resources,
  embeddings,
} from '@/lib/db/schema/resources';
import { db } from '../db';
import { generateEmbeddings } from '@/lib/ai/embedding';

export const createResource = async (input: NewResourceParams): Promise<string> => {
  let resourceId: string | undefined;
  try {
    const { content } = insertResourceSchema.parse(input);

    const [resource] = await db
      .insert(resources)
      .values({
        content,
        source: 'chat',
        status: 'processing',
        title: content.length > 80 ? `${content.slice(0, 77)}...` : content,
      })
      .returning();
    resourceId = resource.id;

    const embeddingsData = await generateEmbeddings(content);
    await db.insert(embeddings).values(
      embeddingsData.map((embedding) => ({
        resourceId: resource.id,
        content: embedding.content,
        embedding: embedding.embedding,
      })),
    );

    await db
      .update(resources)
      .set({ status: 'processed', updatedAt: new Date() })
      .where(eq(resources.id, resource.id));

    return 'Resource successfully created.';
  } catch (e) {
    console.error('createResource failed', e);
    const message =
      e instanceof Error && e.message.length > 0 ? e.message : 'Error, please try again.';
    if (resourceId) {
      await db
        .update(resources)
        .set({ status: 'failed', error: message, updatedAt: new Date() })
        .where(eq(resources.id, resourceId))
        .catch(() => {});
    }
    return message;
  }
};

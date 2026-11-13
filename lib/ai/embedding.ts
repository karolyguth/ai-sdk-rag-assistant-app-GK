import { openai } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';
import { cosineDistance, desc, gt, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { embeddings } from '@/lib/db/schema/resources';
import { chunkDocument } from '@/lib/ai/chunking';

const embeddingModel = openai.embedding('text-embedding-3-small');

export const generateEmbeddings = async (
  value: string,
  fileName?: string,
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const chunks = chunkDocument(value, fileName);
  if (chunks.length === 0) throw new Error('The document is empty, nothing to embed.');
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  });
  return embeddings.map((e, i) => ({ content: chunks[i], embedding: e }));
};

export const generateEmbedding = async (value: string): Promise<number[]> => {
  const input = value.replaceAll('\n', ' ');
  const { embedding } = await embed({
    model: embeddingModel,
    value: input,
  });
  return embedding;
};

export const findRelevantContent = async (userQuery: string) => {
  const userQueryEmbedded = await generateEmbedding(userQuery);
  const similarity = sql<number>`1 - (${cosineDistance(
    embeddings.embedding,
    userQueryEmbedded,
  )})`;
  const similarGuides = await db
    .select({ content: embeddings.content, similarity })
    .from(embeddings)
    .where(gt(similarity, 0.3))
    .orderBy((t) => desc(t.similarity))
    .limit(4);
  
  if (similarGuides.length === 0) {
    return "No relevant information found in the knowledge base.";
  }
  
  return similarGuides.map(guide => guide.content).join('\n');
};
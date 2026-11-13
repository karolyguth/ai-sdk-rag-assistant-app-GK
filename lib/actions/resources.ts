'use server';

import {
  NewResourceParams,
  insertResourceSchema,
} from '@/lib/db/schema/resources';
import { createDocument, processDocument } from '@/lib/documents';

// A hibát szövegként adja vissza, hogy a modell jelezhesse a felhasználónak
export const createResource = async (input: NewResourceParams): Promise<string> => {
  try {
    const { content } = insertResourceSchema.parse(input);
    const title = content.length > 80 ? `${content.slice(0, 77)}...` : content;

    const doc = await createDocument({ content, source: 'chat', title });
    await processDocument(doc.id);

    return 'Resource successfully created.';
  } catch (e) {
    console.error('createResource failed', e);
    return e instanceof Error && e.message.length > 0 ? e.message : 'Error, please try again.';
  }
};

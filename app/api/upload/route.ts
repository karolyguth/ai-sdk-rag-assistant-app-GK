import path from 'node:path';

import { createDocument, findUploadByFileName } from '@/lib/documents';
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_BYTES,
  jsonError,
  serverError,
} from '@/lib/api';

// POST /api/upload ("file" mező) – csak eltárolja, az embedding a /api/process-ben történik
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, 'Expected a multipart/form-data request with a "file" field.');
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return jsonError(400, 'Missing "file" field.');
  }

  const fileName = path.basename(file.name).slice(0, 255);
  const extension = path.extname(fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return jsonError(400, `Unsupported file type "${extension || 'none'}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`);
  }
  if (file.size > MAX_FILE_BYTES) {
    return jsonError(413, `File is too large (${file.size} bytes). Maximum: ${MAX_FILE_BYTES} bytes.`);
  }

  try {
    const content = await file.text();
    if (content.trim().length === 0) {
      return jsonError(400, 'File is empty.');
    }
    if (content.includes('\u0000')) {
      return jsonError(400, 'File does not look like a text file.');
    }

    // Azonos fájlnév kétszer nem tölthető fel, különben duplikált találatok lennének
    const existing = await findUploadByFileName(fileName);
    if (existing) {
      return jsonError(409, `"${fileName}" is already in the knowledge base. Delete it first to upload it again.`);
    }

    const document = await createDocument({ content, fileName, source: 'upload' });
    console.info(`[api] uploaded ${fileName} as ${document.id}`);
    return Response.json(document, { status: 201 });
  } catch (e) {
    return serverError('Upload', e);
  }
}

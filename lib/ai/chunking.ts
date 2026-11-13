// Receptenként egy chunk: a 2. heti mérésben ez adta a legjobb találatokat.
// Hosszú .md: "## " szekciónként a címmel; .txt: bekezdések max. 1500 karakterig, átfedéssel.

export const MAX_WHOLE_DOC_CHARS = 6000;
export const MAX_CHUNK_CHARS = 1500;
const HARD_SPLIT_OVERLAP_CHARS = 200;

export function chunkDocument(content: string, fileName?: string): string[] {
  const text = content.replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const isMarkdown = fileName ? /\.md$/i.test(fileName) : /^#\s+\S/m.test(text);
  return isMarkdown ? chunkMarkdown(text, fileName) : chunkPlainText(text);
}

export function extractTitle(markdown: string, fileName?: string): string | undefined {
  const heading = markdown.match(/^#\s+(.+?)\s*$/m)?.[1];
  if (heading) return heading;
  return fileName?.replace(/\.[^.]+$/, '');
}

function chunkMarkdown(text: string, fileName?: string): string[] {
  if (text.length <= MAX_WHOLE_DOC_CHARS) return [text];

  const title = extractTitle(text, fileName) ?? 'Untitled';
  const [intro, ...sections] = text.split(/\n(?=##\s)/).map(s => s.trim()).filter(Boolean);

  const chunks = [intro, ...sections.map(s => `# ${title}\n\n${s}`)];
  return chunks.flatMap(chunk =>
    chunk.length <= MAX_CHUNK_CHARS * 2
      ? [chunk]
      : chunkPlainText(chunk).map((part, i) => (i === 0 ? part : `# ${title}\n\n${part}`)),
  );
}

function chunkPlainText(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .flatMap(p => (p.length <= MAX_CHUNK_CHARS ? [p] : hardSplit(p)));

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const paragraph of paragraphs) {
    if (current.length > 0 && currentLength + paragraph.length > MAX_CHUNK_CHARS) {
      chunks.push(current.join('\n\n'));
      // Átfedés: a következő chunk az előző utolsó bekezdésével kezdődik
      const last = current[current.length - 1];
      current = last.length + paragraph.length <= MAX_CHUNK_CHARS ? [last] : [];
      currentLength = current.reduce((sum, p) => sum + p.length, 0);
    }
    current.push(paragraph);
    currentLength += paragraph.length;
  }
  if (current.length > 0) chunks.push(current.join('\n\n'));
  return chunks;
}

function hardSplit(paragraph: string): string[] {
  const pieces: string[] = [];
  const step = MAX_CHUNK_CHARS - HARD_SPLIT_OVERLAP_CHARS;
  for (let start = 0; start < paragraph.length; start += step) {
    pieces.push(paragraph.slice(start, start + MAX_CHUNK_CHARS));
    if (start + MAX_CHUNK_CHARS >= paragraph.length) break;
  }
  return pieces;
}

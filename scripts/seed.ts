// Seed script: pnpm db:seed [mappa] (alapértelmezés: data/recipes/recipes)
// Újrafuttatható: a feldolgozottakat átugorja, a hibásakat újrapróbálja.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { ALLOWED_EXTENSIONS, MAX_FILE_BYTES } from '@/lib/api';
import { createDocument, listDocuments, processDocument } from '@/lib/documents';

const DEFAULT_DIR = 'data/recipes/recipes';
const CONCURRENCY = 5;

async function main() {
  const dir = path.resolve(process.argv[2] ?? DEFAULT_DIR);
  if (!existsSync(dir)) {
    console.error(`Folder not found: ${dir}`);
    console.error('Get the recipes with:');
    console.error('  git clone --depth 1 https://github.com/jeffThompson/Recipes.git data/recipes');
    process.exit(1);
  }

  const files = readdirSync(dir)
    .filter(f => ALLOWED_EXTENSIONS.includes(path.extname(f).toLowerCase()))
    .sort();
  console.log(`Seeding ${files.length} file(s) from ${dir}`);

  const existing = new Map(
    (await listDocuments())
      .filter(d => d.source === 'upload' && d.fileName)
      .map(d => [d.fileName!, d]),
  );

  const counts = { processed: 0, skipped: 0, failed: 0, chunks: 0 };
  const started = Date.now();

  const seedFile = async (fileName: string) => {
    const filePath = path.join(dir, fileName);
    const previous = existing.get(fileName);
    if (previous?.status === 'processed') {
      counts.skipped++;
      return;
    }
    try {
      if (statSync(filePath).size > MAX_FILE_BYTES) throw new Error('file too large');
      const content = readFileSync(filePath, 'utf8');
      if (!content.trim()) throw new Error('file is empty');

      const id = previous?.id ?? (await createDocument({ content, fileName, source: 'upload' })).id;
      const { chunkCount } = await processDocument(id);
      counts.processed++;
      counts.chunks += chunkCount;
    } catch (e) {
      counts.failed++;
      console.error(`  ✗ ${fileName}: ${e instanceof Error ? e.message : e}`);
    }
  };

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    await Promise.all(files.slice(i, i + CONCURRENCY).map(seedFile));
    process.stdout.write(`\r  ${Math.min(i + CONCURRENCY, files.length)} / ${files.length}`);
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\nDone in ${seconds}s: ${counts.processed} processed (${counts.chunks} chunks), ` +
      `${counts.skipped} skipped (already processed), ${counts.failed} failed.`,
  );
  process.exit(counts.failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Seeding failed:', e);
  process.exit(1);
});

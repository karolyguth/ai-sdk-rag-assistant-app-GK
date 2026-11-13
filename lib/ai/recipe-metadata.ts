import { extractTitle } from '@/lib/ai/chunking';

// Recept metaadatok, a 2. heti notebook alapján
export type RecipeMetadata = {
  title?: string;
  isRecipe: boolean;
  ingredientsCount: number;
  stepsCount: number;
  prepTime: string | null;
  prepMinutes: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
};

// Határok a lépésszámok 33. és 66. percentiliséből (2. hét)
const EASY_MAX_STEPS = 6;
const MEDIUM_MAX_STEPS = 11;

export function extractRecipeMetadata(markdown: string, fileName?: string): RecipeMetadata {
  const text = markdown.replace(/\r\n/g, '\n');
  const sections = splitSections(text);

  const ingredients = sections.get('ingredients') ?? '';
  const steps = sections.get('steps') ?? '';
  const isRecipe = sections.has('ingredients') || sections.has('steps');

  const ingredientsCount = ingredients.match(/^\s*[*-]\s+\S/gm)?.length ?? 0;
  const stepsCount = steps.match(/^\s*\d+\.\s/gm)?.length ?? 0;

  let prepTime: string | null =
    (sections.get('info') ?? '').split('\n')[0].replace(/^[*\s]+/, '').trim() || null;
  if (prepTime && !/\d|an hour/.test(prepTime)) prepTime = null;

  let prepMinutes: number | null = null;
  if (prepTime) {
    const m = prepTime.match(
      /(\d+(?:\.\d+)?)(?:\s*[–-]\s*\d+(?:\.\d+)?)?\s*(minute|hour)|(an hour)/i,
    );
    if (m?.[3]) prepMinutes = 60;
    else if (m) prepMinutes = Math.round(parseFloat(m[1]) * (m[2].toLowerCase() === 'hour' ? 60 : 1));
  }

  const difficulty = !isRecipe
    ? null
    : stepsCount <= EASY_MAX_STEPS
      ? 'easy'
      : stepsCount <= MEDIUM_MAX_STEPS
        ? 'medium'
        : 'hard';

  return {
    title: extractTitle(text, fileName),
    isRecipe,
    ingredientsCount,
    stepsCount,
    prepTime,
    prepMinutes,
    difficulty,
  };
}

// Összefoglaló sor a chunk elé, hogy idő és nehézség alapján is találjon
export function formatRecipeHeader(meta: RecipeMetadata): string | null {
  if (!meta.isRecipe) return null;
  const parts = [`Recipe: ${meta.title ?? 'Untitled'}`, `difficulty: ${meta.difficulty}`];
  if (meta.prepTime) parts.push(`time: ${meta.prepTime}`);
  parts.push(`${meta.ingredientsCount} ingredients, ${meta.stepsCount} steps`);
  return parts.join(' | ');
}

function splitSections(text: string): Map<string, string> {
  const fragments = text.split(/^##\s+(.+?)\s*$/m);
  const sections = new Map<string, string>();
  for (let i = 1; i < fragments.length; i += 2) {
    const name = fragments[i].replace(/:+$/, '').trim().toLowerCase();
    sections.set(name, (fragments[i + 1] ?? '').trim());
  }
  return sections;
}

import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  streamText,
  UIMessage,
  stepCountIs,
} from 'ai';
import { addResource, getInformation } from '@/lib/ai/tools';
import { env } from '@/lib/env.mjs';

// A gpt-5 többször is kereshet, ezért hosszabb az időkorlát
export const maxDuration = 60;

// Nem angol kérdések: a 2. szabály (angol keresés) és a nyelvi szabály kezeli
const SYSTEM_PROMPT = `You are "Chef", a friendly expert chef assistant for home cooks.

## Your knowledge base
- About 85 English-language home recipes from Jeff Thompson's recipe collection (Indian, Thai, Mexican, Middle Eastern, American and other dishes, sauces, breads). Each recipe starts with a summary line: "Recipe: <title> | difficulty | time | ingredients, steps".
- Personal notes the user asked you to remember (results with source "chat"), e.g. dietary preferences or allergies.
The collection is small: many well-known dishes are NOT in it.

## Your tasks
- Find and recommend recipes from the knowledge base.
- Suggest dishes based on ingredients the user has.
- Explain the cooking techniques used in the recipes.
- Suggest ingredient substitutions.

## How to answer
1. For every cooking question, call getInformation first. Never answer from memory alone.
2. The recipes are in English, so ALWAYS write the search query in English, even if the user writes in another language: turn the question into short English keywords (dish name, main ingredients, traits such as "quick", "vegetarian", "dessert").
3. If the results are weak (similarity below ~0.4 or not on topic), search once or twice more with different English keywords. Do not search more than 3 times for one question.
4. When recommending dishes, also search for "user dietary preferences allergies" and respect what you find (e.g. never recommend meat to a vegetarian).
5. Only use recipes that the tool returned. Never invent a recipe, an ingredient or a quantity. Always name the recipe you used by its title.
6. If the requested dish is not in the collection, say so honestly, then offer 1-3 of the closest recipes that were found, explaining briefly why they are similar. Do not write the missing recipe from general knowledge.
7. For substitutions and technique explanations you may add general cooking knowledge, but say clearly that it is general advice, not part of the recipe.
8. Only call addResource when the user explicitly asks you to remember something.
9. Politely decline questions unrelated to cooking and food, and steer back to recipes.

## Tone and format
- Answer in the language the user writes in (usually English), in a friendly, encouraging, concise tone. If it is not English, keep the original recipe title and add a translation in parentheses.
- When giving a full recipe: a one-sentence intro, the ingredients as a "- " list, then numbered steps. Keep the original quantities and units.
- Use plain text lists only: no Markdown bold, italics, headings or tables.`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Időmérés a teszt riporthoz: első token és teljes idő
  const startedAt = Date.now();
  let firstTokenMs: number | null = null;
  const lastUserText =
    messages.at(-1)?.parts.find(p => p.type === 'text')?.text.slice(0, 80) ?? '';

  const result = streamText({
    model: openai(env.CHAT_MODEL),
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(6),
    system: SYSTEM_PROMPT,
    tools: { addResource, getInformation },
    onChunk: ({ chunk }) => {
      if (chunk.type === 'text-delta' && firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
    },
    onFinish: ({ steps, totalUsage }) => {
      const toolCalls = steps
        .flatMap(step => step.toolCalls)
        .map(call => `${call.toolName}(${JSON.stringify(call.input)})`);
      console.info(
        `[chat] model=${env.CHAT_MODEL} firstToken=${firstTokenMs ?? '-'}ms total=${Date.now() - startedAt}ms ` +
          `steps=${steps.length} tokens=${totalUsage.inputTokens ?? '?'}in/${totalUsage.outputTokens ?? '?'}out ` +
          `question="${lastUserText}" tools=[${toolCalls.join(', ')}]`,
      );
    },
    onError: ({ error }) => {
      console.error(`[chat] failed after ${Date.now() - startedAt}ms for "${lastUserText}":`, error);
    },
  });

  return result.toUIMessageStreamResponse();
}

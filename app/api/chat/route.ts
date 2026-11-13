import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  streamText,
  UIMessage,
  stepCountIs,
} from 'ai';
import { addResource, getInformation } from '@/lib/ai/tools';
import { env } from '@/lib/env.mjs';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai(env.CHAT_MODEL),
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    system: `You are a helpful assistant. Check your knowledge base before answering any questions.
    Only respond to questions using information from tool calls.
    if no relevant information is found in the tool calls, respond, "Sorry, I don't know."
    But follow the conversation, so use information from both the tool calls and the conversation.`,
    tools: { addResource, getInformation },
  });

  return result.toUIMessageStreamResponse();
}

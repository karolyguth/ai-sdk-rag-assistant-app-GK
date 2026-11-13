'use client';

import { useChat } from '@ai-sdk/react';
import { getToolName, isToolUIPart } from 'ai';
import { ChefHat, Loader2, Square } from 'lucide-react';
import { useState } from 'react';

import { notifyDocumentsChanged } from '@/components/document-list';
import { Button } from '@/components/ui/button';

const EXAMPLE_QUESTIONS = [
  'What dessert can I make with chocolate?',
  'What can I cook if I have chicken breast at home?',
  'Any quick dinner ideas?',
  'How do I make carbonara?',
  'Which vegetarian main dishes do you recommend?',
];

export function Chat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, error, regenerate, stop } = useChat({
    // Új jegyzet mentésekor frissül a dokumentumlista
    onFinish: ({ message }) => {
      if (message.parts.some(p => isToolUIPart(p) && getToolName(p) === 'addResource')) {
        notifyDocumentsChanged();
      }
    },
  });

  const busy = status === 'submitted' || status === 'streaming';

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput('');
  };

  return (
    <div className="flex flex-col w-full max-w-2xl py-24 mx-auto stretch">
      <header className="mb-6 flex items-center gap-3">
        <ChefHat className="h-8 w-8 shrink-0" aria-hidden />
        <div>
          <h1 className="text-xl font-semibold">Recipe Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Ask about the recipes in the knowledge base: ingredients, quick ideas, techniques, substitutions.
          </p>
        </div>
      </header>

      {messages.length === 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map(q => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className="rounded-full border px-3 py-1 text-sm hover:bg-accent"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {messages.map(m => {
          const textParts = m.parts.filter(p => p.type === 'text');
          const toolParts = m.parts.filter(isToolUIPart);

          return (
            <div key={m.id} className="whitespace-pre-wrap">
              <div>
                <div className="font-bold mb-2">{m.role === 'user' ? 'You' : 'Chef'}</div>

                {/* Show text content naturally */}
                {textParts.map((part, index) => (
                  <p key={index} className="mb-2">{part.text}</p>
                ))}

                {/* Show collapsible tool details */}
                {toolParts.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                      ▶ Show how I found this ({toolParts.length} tool call{toolParts.length !== 1 ? 's' : ''})
                    </summary>
                    <div className="mt-2 pl-4 border-l-2 border-gray-200 space-y-2">
                      {toolParts.map((part, index) => (
                        <div key={index} className="text-sm">
                          <p className="font-medium">
                            {part.state === 'output-available' ? 'Called' : 'Calling'}{' '}
                            {getToolName(part)}
                          </p>
                          <pre className="my-1 bg-zinc-100 p-2 rounded-sm text-xs overflow-x-auto">
                            Input: {JSON.stringify(part.input, null, 2)}
                          </pre>
                          {part.state === 'output-available' && part.output ? (
                            <pre className="my-1 bg-green-100 p-2 rounded-sm text-xs overflow-x-auto">
                              Output: {typeof part.output === 'string' ? part.output : JSON.stringify(part.output, null, 2)}
                            </pre>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          );
        })}

        {/* Várakozásjelző: a gpt-5 20–30 mp-ig is gondolkodhat */}
        {status === 'submitted' && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching the recipes and thinking…
          </p>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            Something went wrong while answering.{' '}
            <button className="underline" onClick={() => regenerate()}>
              Try again
            </button>
          </div>
        )}
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          send(input);
        }}
        className="fixed bottom-0 mb-8 flex w-full max-w-md gap-2"
      >
        <input
          className="flex-1 p-2 border border-gray-300 rounded shadow-xl disabled:bg-zinc-50"
          value={input}
          placeholder={busy ? 'Chef is answering…' : 'Ask about a recipe…'}
          aria-label="Your question"
          disabled={busy}
          onChange={e => setInput(e.currentTarget.value)}
        />
        {busy && (
          <Button type="button" variant="outline" size="icon" onClick={() => stop()} aria-label="Stop answering">
            <Square className="h-4 w-4" />
          </Button>
        )}
      </form>
    </div>
  );
}

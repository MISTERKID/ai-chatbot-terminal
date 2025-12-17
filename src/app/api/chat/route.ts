import { getEmbedding } from '@/lib/embeddings';
import { HybridVectorStore } from '@/lib/vector-store';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Must use Node.js runtime for local file access and Transformers.js
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { messages } = await req.json();

  // 1. Get user's last message
  const lastMessage = messages[messages.length - 1];
  const userQuestion = lastMessage.content;

  // 2. Retrieval (RAG)
  let contextText = '';
  let sources: string[] = [];

  try {
    // Generate embedding for the question
    const embedding = await getEmbedding(userQuestion);

    // Search vector store
    const store = HybridVectorStore.getInstance();
    const results = await store.search(embedding, 3); // Top 3 results

    if (results.length > 0) {
      contextText = results.map(doc => doc.text).join('\n\n---\n\n');
      sources = results.map(doc => doc.metadata.filename);
      console.log('RAG: Found relevant documents:', sources);
    }
  } catch (error) {
    console.error('RAG Error:', error);
    // Continue without RAG if it fails
  }

  // 3. Construct messages with context
  let finalMessages = messages.map((m: any) => ({
    role: m.role,
    content: m.content
  }));

  if (contextText) {
    const systemPrompt = `You are an AI assistant. Use the following context to answer the user's question. 
If the answer is not in the context, say so, but you can still use your general knowledge if helpful.
Always specify which document you used if applicable.

Context:
${contextText}`;

    // Insert system prompt at the beginning or update existing one
    const systemMessageIndex = finalMessages.findIndex((m: any) => m.role === 'system');
    if (systemMessageIndex >= 0) {
      finalMessages[systemMessageIndex].content += `\n\n${systemPrompt}`;
    } else {
      finalMessages.unshift({ role: 'system', content: systemPrompt });
    }
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: finalMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API Error:', errorText);
      return new Response(errorText, { status: response.status });
    }

    const stream = new ReadableStream({
      async start(controller) {
        // If we have sources, send them as a special initial chunk or just let client generic logic handle it?
        // The client expects a stream of text.
        // I'll append sources to the end of the stream or just let the model mention them (as prompted).
        // BUT, to show "Sources: file.pdf" explicitly in UI like the user requested, 
        // I can send a custom header or just append it to the text.
        // Appending to text is safest for streaming.

        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

              const data = trimmedLine.slice(6);
              if (data === '[DONE]') continue;

              try {
                const json = JSON.parse(data);
                const content = json.choices[0]?.delta?.content || '';
                if (content) {
                  controller.enqueue(new TextEncoder().encode(content));
                }
              } catch (e) {
                console.error('Error parsing JSON:', e);
              }
            }
          }
          // Append sources at the end if any
          if (sources.length > 0) {
            const sourcesText = `\n\n[Sources: ${sources.join(', ')}]`;
            controller.enqueue(new TextEncoder().encode(sourcesText));
          }

        } catch (error) {
          console.error('Stream processing error:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream);

  } catch (error) {
    console.error('Handler error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

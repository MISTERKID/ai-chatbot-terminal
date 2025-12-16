'use client';

import { useState, useEffect, useRef } from 'react';

export default function TerminalChat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ id: string, role: string, content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content }))
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: '' };

      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        assistantMessage.content += chunk;
        setMessages(prev => [...prev.slice(0, -1), { ...assistantMessage }]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
      // Refocus the input after response completes
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#00ff00] font-mono p-6 relative overflow-hidden">
      {/* Scanline effect */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-10">
        <div className="h-full w-full bg-gradient-to-b from-transparent via-[#00ff00] to-transparent animate-scan" />
      </div>

      {/* CRT screen curvature effect */}
      <div className="pointer-events-none fixed inset-0 z-40 bg-gradient-radial from-transparent via-transparent to-black/30" />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* ASCII Header */}
        <pre className="text-[8px] sm:text-[10px] mb-4 opacity-70 leading-tight text-center">
          {`
 █████╗ ██╗     ██████╗██╗  ██╗ █████╗ ████████╗██████╗  ██████╗ ████████╗    ████████╗███████╗██████╗ ███╗   ███╗██╗███╗   ██╗ █████╗ ██╗     
██╔══██╗██║    ██╔════╝██║  ██║██╔══██╗╚══██╔══╝██╔══██╗██╔═══██╗╚══██╔══╝    ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗██║     
███████║██║    ██║     ███████║███████║   ██║   ██████╔╝██║   ██║   ██║          ██║   █████╗  ██████╔╝██╔████╔██║██║██╔██╗ ██║███████║██║     
██╔══██║██║    ██║     ██╔══██║██╔══██║   ██║   ██╔══██╗██║   ██║   ██║          ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║██║╚██╗██║██╔══██║██║     
██║  ██║██║    ╚██████╗██║  ██║██║  ██║   ██║   ██████╔╝╚██████╔╝   ██║          ██║   ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║███████╗
╚═╝  ╚═╝╚═╝     ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═════╝  ╚═════╝    ╚═╝          ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝
`}
        </pre>

        <div className="border border-[#00ff00] p-6 bg-black/50 backdrop-blur-sm shadow-[0_0_20px_rgba(0,255,0,0.3)] rounded">
          {/* System Info */}
          <div className="mb-4 text-[11px] opacity-60 space-y-0.5">
            <p>AI CHATBOT TERMINAL v1.0.0</p>
            <p>System: LPU Inference Engine</p>
            <p>Model: llama-3.1-8b-instant</p>
            <div className="mt-2 h-px bg-[#00ff00]/20" />
          </div>

          {/* Messages */}
          <div className="space-y-2 mb-4 max-h-[55vh] overflow-y-auto pr-2 scrollbar-thin">
            {messages.length === 0 && (
              <div className="opacity-50 text-sm">
                <p>&gt; Ready for input...</p>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className="space-y-1 text-sm">
                {m.role === 'user' ? (
                  <>
                    <p className="text-[#00ff00]">
                      <span className="opacity-60">user@ai</span>
                      <span className="opacity-40">:</span>
                      <span className="opacity-60">~</span>
                      <span className="text-[#00ff00]">$</span> <span className="text-white">{m.content}</span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[#00ff00] opacity-50 text-xs">&gt; RESPONSE:</p>
                    <p className="text-[#00ff00] pl-3 whitespace-pre-wrap leading-relaxed opacity-90">
                      {m.content}
                    </p>
                  </>
                )}
              </div>
            ))}
            {isLoading && (
              <span className="inline-block animate-pulse text-sm">█</span>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="relative mt-4 pt-3 border-t border-[#00ff00]/20">
            <div className="flex items-center gap-1 text-sm">
              <span className="text-[#00ff00] opacity-60 shrink-0">
                user@ai<span className="opacity-40">:</span>
                <span className="opacity-60">~</span>
                <span className="text-[#00ff00]">$</span>
              </span>
              <span className="text-[#00ff00]">{input}</span>
              {isFocused && <span className="text-[#00ff00] animate-pulse">▊</span>}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={isLoading}
              className="absolute inset-0 opacity-0 w-full"
              autoFocus
              spellCheck={false}
            />
          </form>

          {/* Status bar */}
          <div className="mt-3 pt-2 border-t border-[#00ff00]/10 text-[10px] opacity-40 flex justify-between">
            <span>STATUS: {isLoading ? 'PROCESSING...' : 'READY'}</span>
            <span>MSGS: {messages.length}</span>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center mt-3 text-[10px] opacity-30">
          Powered by Groq LPU™
        </p>
      </div>

      <style jsx global>{`
        @keyframes scan {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(100%);
          }
        }
        .animate-scan {
          animation: scan 8s linear infinite;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(0, 255, 0, 0.2);
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}

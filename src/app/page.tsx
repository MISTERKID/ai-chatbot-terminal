'use client';

import { useState, useEffect, useRef } from 'react';

type FileItem = { id: string; filename: string; mode: string };

let messageIdCounter = 0;
const generateMessageId = () => `msg-${Date.now()}-${messageIdCounter++}`;

export default function TerminalChat() {
  const [input, setInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [messages, setMessages] = useState<Array<{ id: string, role: string, content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [docStats, setDocStats] = useState({ temporary: 0, permanent: 0 });
  const [uploadMode, setUploadMode] = useState<'temporary' | 'permanent'>('temporary');

  // Delete mode states
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteFiles, setDeleteFiles] = useState<FileItem[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  // Clear mode states
  const [clearMode, setClearMode] = useState(false);
  const [selectedClearOption, setSelectedClearOption] = useState(0);
  const clearOptions = ['Clear All', 'Clear Temporary', 'Clear Permanent'];

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch document stats
  const fetchDocStats = async () => {
    try {
      const res = await fetch('/api/docs/list');
      const data = await res.json();
      setDocStats({
        temporary: data.temporary?.length || 0,
        permanent: data.permanent?.length || 0
      });
    } catch (e) {
      console.error('Failed to fetch doc stats', e);
    }
  };

  useEffect(() => {
    fetchDocStats();
  }, []);

  // Keep input focused in delete/clear mode and refocus when exiting
  useEffect(() => {
    // Always refocus the input when deleteMode or clearMode changes
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [deleteMode, deleteFiles, clearMode]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadMsgId = generateMessageId();
    setMessages(prev => [...prev, {
      id: uploadMsgId,
      role: 'assistant',
      content: `Uploading ${file.name} to ${uploadMode} storage...`
    }]);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', uploadMode);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        setMessages(prev => prev.map(m =>
          m.id === uploadMsgId
            ? { ...m, content: `✓ Uploaded ${file.name} to ${uploadMode} storage.` }
            : m
        ));
        fetchDocStats();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setMessages(prev => prev.map(m =>
        m.id === uploadMsgId
          ? { ...m, content: `❌ Upload failed: ${error}` }
          : m
      ));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async () => {
    const fileToDelete = deleteFiles[selectedFileIndex];
    if (!fileToDelete) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/docs/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: fileToDelete.id,
          mode: fileToDelete.mode
        })
      });

      if (res.ok) {
        setMessages(prev => [...prev, {
          id: generateMessageId(),
          role: 'assistant',
          content: `✓ Deleted ${fileToDelete.filename}`
        }]);
        fetchDocStats();
        setDeleteMode(false);
        setDeleteFiles([]);
        setSelectedFileIndex(0);
      } else {
        throw new Error('Delete failed');
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        role: 'assistant',
        content: `❌ Failed to delete ${fileToDelete.filename}`
      }]);
    } finally {
      setIsLoading(false);
      // Refocus input after delete completes
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleClearAction = async () => {
    const option = clearOptions[selectedClearOption];
    let targetMode: 'temporary' | 'permanent' | 'all';

    if (option === 'Clear All') {
      targetMode = 'all';
    } else if (option === 'Clear Temporary') {
      targetMode = 'temporary';
    } else {
      targetMode = 'permanent';
    }



    setIsLoading(true);
    try {
      const res = await fetch('/api/docs/clear', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: targetMode })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Clear failed');
      }

      setMessages(prev => [...prev, {
        id: generateMessageId(),
        role: 'assistant',
        content: `✓ Cleared ${targetMode} documents.`
      }]);
      fetchDocStats();
      setClearMode(false);
      setSelectedClearOption(0);
    } catch (e) {
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        role: 'assistant',
        content: `Failed to clear docs: ${e}`
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleCommand = async (cmd: string) => {
    const args = cmd.split(' ');
    const command = args[0];

    if (command === '/upload') {
      const mode = args[1];

      // Set upload mode
      if (mode === 'save' || mode === 'permanent') {
        setUploadMode('permanent');
      } else {
        setUploadMode('temporary');
      }

      // Trigger file picker
      setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      }, 50);

      return true;
    }

    if (command === '/docs') {
      setIsLoading(true);
      try {
        const res = await fetch('/api/docs/list');
        const data = await res.json();

        let content = 'Indexed Documents:\n\n';
        content += '--- Temporary (Session) ---\n';
        if (data.temporary?.length) {
          data.temporary.forEach((d: any) => content += `📄 ${d.filename}\n`);
        } else {
          content += '(none)\n';
        }

        content += '\n--- Permanent (Saved) ---\n';
        if (data.permanent?.length) {
          data.permanent.forEach((d: any) => content += `📄 ${d.filename}\n`);
        } else {
          content += '(none)\n';
        }

        setMessages(prev => [...prev, {
          id: generateMessageId(),
          role: 'assistant',
          content
        }]);
      } catch (e) {
        setMessages(prev => [...prev, { id: generateMessageId(), role: 'assistant', content: 'Failed to list docs.' }]);
      } finally {
        setIsLoading(false);
      }
      return true;
    }

    if (command === '/clear') {
      setClearMode(true);
      setSelectedClearOption(0);
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        role: 'assistant',
        content: 'Use ↑/↓ arrows to select option, Enter to confirm, Esc to cancel.'
      }]);
      return true;
    }

    if (command === '/delete') {
      setIsLoading(true);
      try {
        const res = await fetch('/api/docs/list');
        const data = await res.json();

        const allFiles: FileItem[] = [];

        if (data.temporary?.length) {
          data.temporary.forEach((d: any) => {
            allFiles.push({ id: d.id, filename: d.filename, mode: 'temporary' });
          });
        }

        if (data.permanent?.length) {
          data.permanent.forEach((d: any) => {
            allFiles.push({ id: d.id, filename: d.filename, mode: 'permanent' });
          });
        }

        if (allFiles.length === 0) {
          setMessages(prev => [...prev, {
            id: generateMessageId(),
            role: 'assistant',
            content: 'No files to delete.'
          }]);
        } else {
          setDeleteFiles(allFiles);
          setSelectedFileIndex(0);
          setDeleteMode(true);
          setMessages(prev => [...prev, {
            id: generateMessageId(),
            role: 'assistant',
            content: 'Use ↑/↓ arrows to select file, Enter to delete, Esc to cancel.'
          }]);
        }
      } catch (e) {
        setMessages(prev => [...prev, {
          id: generateMessageId(),
          role: 'assistant',
          content: 'Failed to load files.'
        }]);
      } finally {
        setIsLoading(false);
      }
      return true;
    }

    return false;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isLoading) return;

    // Handle clear mode navigation
    if (clearMode) {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedClearOption(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedClearOption(prev => Math.min(clearOptions.length - 1, prev + 1));
          break;
        case 'Enter':
          e.preventDefault();
          handleClearAction();
          break;
        case 'Escape':
          e.preventDefault();
          setClearMode(false);
          setSelectedClearOption(0);
          setMessages(prev => [...prev, {
            id: generateMessageId(),
            role: 'assistant',
            content: 'Clear cancelled.'
          }]);
          break;
      }
      return;
    }

    // Handle delete mode navigation
    if (deleteMode) {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedFileIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedFileIndex(prev => Math.min(deleteFiles.length - 1, prev + 1));
          break;
        case 'Enter':
          e.preventDefault();
          handleDeleteFile();
          break;
        case 'Escape':
          e.preventDefault();
          setDeleteMode(false);
          setDeleteFiles([]);
          setSelectedFileIndex(0);
          setMessages(prev => [...prev, {
            id: generateMessageId(),
            role: 'assistant',
            content: 'Delete cancelled.'
          }]);
          break;
      }
      return;
    }

    // Normal input mode
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setCursorPosition(prev => Math.max(0, prev - 1));
        break;
      case 'ArrowRight':
        e.preventDefault();
        setCursorPosition(prev => Math.min(input.length, prev + 1));
        break;
      case 'Home':
        e.preventDefault();
        setCursorPosition(0);
        break;
      case 'End':
        e.preventDefault();
        setCursorPosition(input.length);
        break;
      case 'Backspace':
        if (cursorPosition > 0) {
          e.preventDefault();
          const newInput = input.slice(0, cursorPosition - 1) + input.slice(cursorPosition);
          setInput(newInput);
          setCursorPosition(cursorPosition - 1);
        }
        break;
      case 'Delete':
        if (cursorPosition < input.length) {
          e.preventDefault();
          const newInput = input.slice(0, cursorPosition) + input.slice(cursorPosition + 1);
          setInput(newInput);
        }
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          const newInput = input.slice(0, cursorPosition) + e.key + input.slice(cursorPosition);
          setInput(newInput);
          setCursorPosition(cursorPosition + 1);
        }
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const cmd = input.trim();
    const userMessage = { id: generateMessageId(), role: 'user', content: cmd };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setCursorPosition(0);

    // Check for commands first
    if (cmd.startsWith('/')) {
      const handled = await handleCommand(cmd);
      if (handled) return;
    }

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
      setMessages(prev => [...prev, { id: generateMessageId(), role: 'assistant', content: 'Connection failed.' }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };


  return (
    <div className="h-screen bg-black text-[#00ff00] font-mono p-4 sm:p-6 relative overflow-hidden flex flex-col">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept=".txt,.md,.json,.js,.ts,.tsx,.csv,.pdf"
      />

      <div className="pointer-events-none fixed inset-0 z-50 opacity-10">
        <div className="h-full w-full bg-linear-to-b from-transparent via-[#00ff00] to-transparent animate-scan" />
      </div>

      <div className="pointer-events-none fixed inset-0 z-40 bg-gradient-radial from-transparent via-transparent to-black/30" />

      <div className="max-w-5xl w-full mx-auto relative z-10 flex flex-col h-full">
        <pre className="text-[8px] sm:text-[10px] mb-4 opacity-70 leading-tight text-center shrink-0">
          {`
 █████╗ ██╗     ██████╗██╗  ██╗ █████╗ ████████╗██████╗  ██████╗ ████████╗    ████████╗███████╗██████╗ ███╗   ███╗██╗███╗   ██╗ █████╗ ██╗     
██╔══██╗██║    ██╔════╝██║  ██║██╔══██╗╚══██╔══╝██╔══██╗██╔═══██╗╚══██╔══╝    ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗██║     
███████║██║    ██║     ███████║███████║   ██║   ██████╔╝██║   ██║   ██║          ██║   █████╗  ██████╔╝██╔████╔██║██║██╔██╗ ██║███████║██║     
██╔══██║██║    ██║     ██╔══██║██╔══██║   ██║   ██╔══██╗██║   ██║   ██║          ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║██║╚██╗██║██╔══██║██║     
██║  ██║██║    ╚██████╗██║  ██║██║  ██║   ██║   ██████╔╝╚██████╔╝   ██║          ██║   ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║███████╗
╚═╝  ╚═╝╚═╝     ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═════╝  ╚═════╝    ╚═╝          ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝
`}
        </pre>

        <div className="border border-[#00ff00] p-4 sm:p-6 bg-black/50 backdrop-blur-sm shadow-[0_0_20px_rgba(0,255,0,0.3)] rounded flex flex-col flex-1 min-h-0">
          <div className="mb-4 text-[11px] opacity-60 space-y-0.5 shrink-0">
            <p>AI CHATBOT TERMINAL v1.0.0</p>
            <p>System: LPU Inference Engine [Hybrid RAG Enabled]</p>
            <p>Model: llama-3.1-8b-instant</p>
            <p>Session Docs: {docStats.temporary} | Saved Docs: {docStats.permanent}</p>
            <div className="mt-2 h-px bg-[#00ff00]/20" />
            <div className="text-[10px] mt-1 opacity-50">
              Usage: <span className="text-white">/upload [temp|save]</span> to upload, <span className="text-white">/docs</span> to list, <span className="text-white">/delete</span> to remove, <span className="text-white">/clear</span> to bulk delete
            </div>
          </div>

          <div className="space-y-2 mb-4 flex-1 overflow-y-auto pr-2 scrollbar-thin min-h-0" onClick={() => inputRef.current?.focus()}>
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
                      <span className="opacity-60">me@ai</span>
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

            {/* Clear mode options menu */}
            {clearMode && (
              <div className="my-2 p-3 border border-[#00ff00]/30 rounded bg-black/30 w-full max-w-md">
                <p className="text-xs opacity-60 mb-2">Select clear option:</p>
                {clearOptions.map((option, idx) => (
                  <div
                    key={idx}
                    className={`text-sm py-1 px-2 ${idx === selectedClearOption
                      ? 'bg-[#00ff00] text-black font-bold'
                      : 'text-[#00ff00]'
                      }`}
                  >
                    {idx === selectedClearOption && '► '}
                    {option}
                  </div>
                ))}
              </div>
            )}

            {/* Delete mode file list */}
            {deleteMode && deleteFiles.length > 0 && (
              <div className="my-2 p-3 border border-[#00ff00]/30 rounded bg-black/30 w-full max-w-md">
                <p className="text-xs opacity-60 mb-2">Select file to delete:</p>
                {deleteFiles.map((file, idx) => (
                  <div
                    key={file.id}
                    className={`text-sm py-1 px-2 ${idx === selectedFileIndex
                      ? 'bg-[#00ff00] text-black font-bold'
                      : 'text-[#00ff00]'
                      }`}
                  >
                    {idx === selectedFileIndex && '► '}
                    {file.filename} <span className="opacity-50 text-xs">({file.mode})</span>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative mt-2">
              <div className="flex items-center gap-1 text-sm">
                <span className="text-[#00ff00] opacity-60 shrink-0">
                  me@ai<span className="opacity-40">:</span>
                  <span className="opacity-60">~</span>
                  <span className="text-[#00ff00]">$</span>
                </span>
                <span className="text-[#00ff00] relative">
                  {input.split('').map((char, i) => (
                    <span key={i} className="relative inline-block">
                      {i === cursorPosition && isFocused && (
                        <span className="absolute inset-0 bg-[#00ff00] animate-pulse" />
                      )}
                      <span className={i === cursorPosition && isFocused ? "relative text-black" : "relative"}>
                        {char === ' ' ? '\u00A0' : char}
                      </span>
                    </span>
                  ))}
                  {cursorPosition === input.length && isFocused && (
                    <span className="inline-block bg-[#00ff00] animate-pulse">
                      <span className="text-black opacity-0">_</span>
                    </span>
                  )}
                </span>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setCursorPosition(e.target.value.length);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={isLoading}
                className="absolute inset-0 opacity-0 w-full"
                autoFocus
                spellCheck={false}
              />
            </form>

            <div ref={messagesEndRef} />
          </div>

          <div className="mt-3 pt-2 border-t border-[#00ff00]/10 text-[10px] opacity-40 flex justify-between shrink-0">
            <span>STATUS: {isLoading ? 'PROCESSING...' : clearMode ? 'CLEAR MODE' : deleteMode ? 'DELETE MODE' : 'READY'}</span>
            <span>MSGS: {messages.length}</span>
          </div>
        </div>

        <p className="text-center mt-3 text-[10px] opacity-30 shrink-0">
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

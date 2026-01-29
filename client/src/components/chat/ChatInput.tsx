import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, Square, X, ChevronDown, Sparkles, Check } from 'lucide-react';
import { api } from '../../api/http';

interface PendingImage {
  name: string;
  preview: string; // object URL for display
  data: string;    // base64 data
}

const MODELS = [
  { value: 'sonnet', label: 'Sonnet', desc: 'Balanced speed and intelligence' },
  { value: 'haiku', label: 'Haiku', desc: 'Fast and lightweight' },
  { value: 'opus', label: 'Opus', desc: 'Most capable, highest quality' },
];

interface Props {
  onSend: (content: string, images?: string[], model?: string, thinking?: boolean) => void;
  onStop: () => void;
  streaming: boolean;
  disabled: boolean;
  defaultModel?: string;
  defaultThinking?: boolean;
}

export default function ChatInput({ onSend, onStop, streaming, disabled, defaultModel, defaultThinking }: Props) {
  const [input, setInput] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [model, setModel] = useState(defaultModel || 'sonnet');
  const [thinking, setThinking] = useState(defaultThinking || false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  // Sync defaults when they change
  useEffect(() => { if (defaultModel) setModel(defaultModel); }, [defaultModel]);
  useEffect(() => { if (defaultThinking !== undefined) setThinking(defaultThinking); }, [defaultThinking]);

  useEffect(() => {
    if (!streaming && !disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [streaming, disabled]);

  // Close model menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setShowModelMenu(false);
      }
    };
    if (showModelMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModelMenu]);

  const addImageFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const newImages: PendingImage[] = [];
    for (const file of imageFiles) {
      const data = await fileToBase64(file);
      newImages.push({
        name: file.name,
        preview: URL.createObjectURL(file),
        data,
      });
    }
    setImages(prev => [...prev, ...newImages]);
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages(prev => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSubmit = async () => {
    if ((!input.trim() && images.length === 0) || disabled) return;

    let imagePaths: string[] | undefined;

    if (images.length > 0) {
      setUploading(true);
      try {
        const uploads = await Promise.all(
          images.map(img =>
            api.post<{ path: string }>('/upload/image', { data: img.data, filename: img.name })
          )
        );
        imagePaths = uploads.map(u => u.path);
      } catch (err) {
        console.error('Failed to upload images:', err);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onSend(input.trim() || 'See attached image(s)', imagePaths, model, thinking);
    setInput('');
    // Clean up previews
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      addImageFiles(files);
    }
  }, [addImageFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    addImageFiles(files);
  }, [addImageFiles]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 300) + 'px';
    }
  }, [input]);

  const canSend = (input.trim() || images.length > 0) && !disabled && !uploading;
  const currentModel = MODELS.find(m => m.value === model) || MODELS[0];
  const buttonLabel = thinking ? `${currentModel.label} (thinking)` : currentModel.label;

  return (
    <div
      ref={dropRef}
      className="border-t border-gray-800/50 px-4 py-3 bg-[#0d1117]"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#161b22] border border-gray-700/50 rounded-xl focus-within:border-accent-500/50 transition-colors">
          {/* Image previews */}
          {images.length > 0 && (
            <div className="flex gap-2 px-4 pt-3 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative group">
                  <img
                    src={img.preview}
                    alt={img.name}
                    className="h-16 w-16 object-cover rounded-lg border border-gray-700"
                  />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 bg-gray-800 border border-gray-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} className="text-gray-300" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={disabled ? 'Select a session to start chatting...' : 'Message...'}
            disabled={disabled || streaming}
            rows={3}
            className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm text-white placeholder-gray-600 focus:outline-none disabled:opacity-50"
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-3 pb-2.5">
            <div className="flex items-center gap-1.5">
              {/* Model selector */}
              <div className="relative" ref={modelMenuRef}>
                <button
                  onClick={() => setShowModelMenu(!showModelMenu)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    thinking
                      ? 'text-amber-400 hover:bg-amber-500/10'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                  }`}
                >
                  {buttonLabel}
                  <ChevronDown size={12} />
                </button>
                {showModelMenu && (
                  <div className="absolute bottom-full left-0 mb-1 bg-[#1c2129] border border-gray-700/60 rounded-lg shadow-xl z-50 min-w-[240px] py-1">
                    {MODELS.map((m) => (
                      <button
                        key={m.value}
                        onClick={() => { setModel(m.value); setShowModelMenu(false); }}
                        className={`w-full text-left px-3 py-2.5 transition-colors flex items-center gap-3 ${
                          model === m.value
                            ? 'bg-accent-600/15'
                            : 'hover:bg-gray-800/60'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${model === m.value ? 'text-accent-400' : 'text-gray-200'}`}>
                            {m.label}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">{m.desc}</div>
                        </div>
                        {model === m.value && (
                          <Check size={14} className="text-accent-400 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                    {/* Thinking toggle */}
                    <div className="border-t border-gray-700/40 mt-1 pt-1">
                      <button
                        onClick={() => { setThinking(!thinking); setShowModelMenu(false); }}
                        className={`w-full text-left px-3 py-2.5 transition-colors flex items-center gap-3 ${
                          thinking
                            ? 'bg-amber-500/10'
                            : 'hover:bg-gray-800/60'
                        }`}
                      >
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <Sparkles size={14} className={thinking ? 'text-amber-400' : 'text-gray-500'} />
                          <div>
                            <div className={`text-sm font-medium ${thinking ? 'text-amber-400' : 'text-gray-200'}`}>
                              Thinking
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5">Extended reasoning before responding</div>
                          </div>
                        </div>
                        {thinking && (
                          <Check size={14} className="text-amber-400 flex-shrink-0" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Send / Stop button */}
            <div>
              {streaming ? (
                <button
                  onClick={onStop}
                  className="p-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
                  title="Stop"
                >
                  <Square size={14} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!canSend}
                  className="p-1.5 bg-accent-600 hover:bg-accent-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-white transition-colors"
                  title="Send"
                >
                  <ArrowUp size={14} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix (e.g. "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

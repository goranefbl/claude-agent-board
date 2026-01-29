import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square, Image, X } from 'lucide-react';
import { api } from '../../api/http';

interface PendingImage {
  name: string;
  preview: string; // object URL for display
  data: string;    // base64 data
}

interface Props {
  onSend: (content: string, images?: string[]) => void;
  onStop: () => void;
  streaming: boolean;
  disabled: boolean;
}

export default function ChatInput({ onSend, onStop, streaming, disabled }: Props) {
  const [input, setInput] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!streaming && !disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [streaming, disabled]);

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

    onSend(input.trim() || 'See attached image(s)', imagePaths);
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
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const canSend = (input.trim() || images.length > 0) && !disabled && !uploading;

  return (
    <div
      ref={dropRef}
      className="border-t border-gray-800/50 p-4 bg-[#161b22]"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="max-w-4xl mx-auto">
        {/* Image previews */}
        {images.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative group">
                <img
                  src={img.preview}
                  alt={img.name}
                  className="h-16 w-16 object-cover rounded border border-gray-700"
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

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={disabled ? 'Select a session to start chatting...' : 'Type a message... (paste or drop images)'}
            disabled={disabled || streaming}
            rows={1}
            className="flex-1 resize-none bg-[#0d1117] border border-gray-700/50 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-500/50 disabled:opacity-50"
          />
          {streaming ? (
            <button
              onClick={onStop}
              className="p-3 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
              title="Stop"
            >
              <Square size={18} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSend}
              className="p-3 bg-accent-600 hover:bg-accent-700 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-white transition-colors"
              title="Send"
            >
              {uploading ? (
                <Image size={18} className="animate-pulse" />
              ) : (
                <Send size={18} />
              )}
            </button>
          )}
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

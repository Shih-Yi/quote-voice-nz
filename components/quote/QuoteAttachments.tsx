"use client";

import { useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { QuoteAttachment } from "@/types/quote";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
const MAX_ATTACHMENTS = 10;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

interface QuoteAttachmentsProps {
  attachments: QuoteAttachment[];
  onChange: (attachments: QuoteAttachment[]) => void;
  readOnly?: boolean;
}

export function QuoteAttachments({ attachments, onChange, readOnly }: QuoteAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const remaining = MAX_ATTACHMENTS - attachments.length;
      if (remaining <= 0) {
        toast.error(`Maximum ${MAX_ATTACHMENTS} photos allowed`);
        return;
      }

      const filesToProcess = Array.from(files).slice(0, remaining);
      const newAttachments: QuoteAttachment[] = [];

      for (const file of filesToProcess) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          toast.error(`${file.name}: unsupported format`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name}: exceeds 5MB limit`);
          continue;
        }

        try {
          const dataUrl = await readFileAsDataUrl(file);
          newAttachments.push({
            id: uuidv4(),
            name: file.name,
            dataUrl,
            mimeType: file.type,
            size: file.size,
            createdAt: new Date().toISOString(),
          });
        } catch {
          toast.error(`Failed to read ${file.name}`);
        }
      }

      if (newAttachments.length > 0) {
        onChange([...attachments, ...newAttachments]);
        toast.success(`${newAttachments.length} photo(s) added`);
      }

      // Reset input so same file can be re-selected
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [attachments, onChange]
  );

  const handleRemove = useCallback(
    (id: string) => {
      onChange(attachments.filter((a) => a.id !== id));
    },
    [attachments, onChange]
  );

  return (
    <div className="space-y-3">
      {/* Image grid */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {attachments.map((att) => (
            <div key={att.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={att.dataUrl}
                alt={att.name}
                className="w-full h-full object-cover"
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemove(att.id)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                  aria-label={`Remove ${att.name}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      {!readOnly && attachments.length < MAX_ATTACHMENTS && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            className="w-full gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Add Photos ({attachments.length}/{MAX_ATTACHMENTS})
          </Button>
        </>
      )}

      {attachments.length === 0 && readOnly && (
        <p className="text-text-muted text-sm text-center py-2">No photos attached</p>
      )}
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

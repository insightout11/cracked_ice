import { useCallback, useState } from 'react';
import { Check, Upload } from 'lucide-react';

interface ImageUploadZoneProps {
  title: string;
  description: string;
  onUpload: (file: File) => Promise<void>;
  isUploading?: boolean;
  isComplete?: boolean;
  preview?: string;
}

export function ImageUploadZone({
  title,
  description,
  onUpload,
  isUploading = false,
  isComplete = false,
  preview
}: ImageUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      try {
        await onUpload(file);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    }
  }, [onUpload]);

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setError(null);

    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      try {
        await onUpload(file);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    }
  }, [onUpload]);

  return (
    <div
      className={`relative rounded-xl border-2 border-dashed p-6 transition-all ${
        dragActive
          ? 'border-[var(--accent)] bg-accent/5'
          : isComplete
          ? 'border-positive bg-positive-muted'
          : 'border-line bg-surface-glass'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {isComplete && (
        <div className="absolute top-3 right-3 flex items-center gap-2 text-positive text-sm">
          <Check className="w-5 h-5" aria-hidden="true" />
          <span className="font-semibold">Uploaded</span>
        </div>
      )}

      <div className="flex flex-col items-center gap-3 text-center">
        {preview && (
          <div className="mb-3 max-w-sm rounded-lg overflow-hidden border border-line">
            <img src={preview} alt="Upload preview" className="w-full h-auto" />
          </div>
        )}

        {isUploading ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)]"></div>
            <p className="text-sm text-[var(--ink-mute)]">Processing image...</p>
          </>
        ) : (
          <>
            <Upload className="w-12 h-12 text-ink-mute" aria-hidden="true" />
            <div>
              <h4 className="text-base font-semibold text-[var(--ink)]">{title}</h4>
              <p className="text-xs text-[var(--ink-mute)] mt-1">{description}</p>
            </div>
            <div className="flex items-center gap-3">
              <label
                htmlFor={`file-upload-${title.replace(/\s+/g, '-')}`}
                className="cursor-pointer rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent/90"
              >
                Choose File
              </label>
              <span className="text-xs text-[var(--ink-mute)]">or drag and drop</span>
            </div>
            <input
              id={`file-upload-${title.replace(/\s+/g, '-')}`}
              type="file"
              accept="image/*"
              onChange={handleChange}
              className="hidden"
            />
          </>
        )}

        {error && (
          <div className="mt-2 text-sm text-negative">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

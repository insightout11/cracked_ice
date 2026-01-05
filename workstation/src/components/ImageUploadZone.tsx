import { useCallback, useState } from 'react';

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
          ? 'border-[var(--laser-cyan)] bg-[var(--laser-cyan)]/5'
          : isComplete
          ? 'border-green-500/50 bg-green-500/5'
          : 'border-white/20 bg-black/20'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {isComplete && (
        <div className="absolute top-3 right-3 flex items-center gap-2 text-green-400 text-sm">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-semibold">Uploaded</span>
        </div>
      )}

      <div className="flex flex-col items-center gap-3 text-center">
        {preview && (
          <div className="mb-3 max-w-sm rounded-lg overflow-hidden border border-white/10">
            <img src={preview} alt="Upload preview" className="w-full h-auto" />
          </div>
        )}

        {isUploading ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--laser-cyan)]"></div>
            <p className="text-sm text-[var(--ci-muted)]">Processing image...</p>
          </>
        ) : (
          <>
            <svg
              className="w-12 h-12 text-[var(--ci-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div>
              <h4 className="text-base font-semibold text-[var(--ci-white)]">{title}</h4>
              <p className="text-xs text-[var(--ci-muted)] mt-1">{description}</p>
            </div>
            <div className="flex items-center gap-3">
              <label
                htmlFor={`file-upload-${title.replace(/\s+/g, '-')}`}
                className="cursor-pointer rounded-lg bg-[var(--laser-cyan)] px-4 py-2 text-sm font-semibold text-[#001024] transition hover:bg-[#6ef7ff]"
              >
                Choose File
              </label>
              <span className="text-xs text-[var(--ci-muted)]">or drag and drop</span>
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
          <div className="mt-2 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

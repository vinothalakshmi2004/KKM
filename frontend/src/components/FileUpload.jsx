import { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, X, FileText } from 'lucide-react';

export default function FileUpload({ onFiles, multiple = true, accept = 'image/*,application/pdf', label = 'Upload files' }) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const inputRef = useRef();

  const handleFiles = (newFiles) => {
    const arr = Array.from(newFiles);
    const updated = multiple ? [...files, ...arr] : arr;
    setFiles(updated);
    onFiles(updated);
  };

  const removeFile = (idx) => {
    const updated = files.filter((_, i) => i !== idx);
    setFiles(updated);
    onFiles(updated);
  };

  const isImage = (file) => file.type.startsWith('image/');

  // One preview URL per image, revoked when the file list changes
  const previews = useMemo(() => files.map((f) => (isImage(f) ? URL.createObjectURL(f) : null)), [files]);
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
            : 'border-ink-300 dark:border-ink-600 hover:border-brand-400 hover:bg-ink-50 dark:hover:bg-ink-700/30'
        }`}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-ink-400" />
        <p className="text-sm text-ink-600 dark:text-ink-400">
          <span className="font-medium text-brand-600">{label}</span> or drag & drop
        </p>
        <p className="text-xs text-ink-400 mt-1">Images or PDF files</p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple={multiple}
          accept={accept}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-ink-50 dark:bg-ink-700/50 rounded-lg">
              {isImage(file) ? (
                <img src={previews[idx]} alt="" className="w-10 h-10 rounded object-cover" />
              ) : (
                <FileText className="w-10 h-10 text-ink-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-700 dark:text-ink-300 truncate">{file.name}</p>
                <p className="text-xs text-ink-400">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button type="button" onClick={() => removeFile(idx)} className="text-ink-400 hover:text-red-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

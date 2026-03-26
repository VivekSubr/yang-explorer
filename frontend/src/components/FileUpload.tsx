import React, { useCallback, useState } from 'react';

interface FileUploadProps {
  onUpload: (file: File) => void;
  isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUpload, isLoading }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.yang')) {
        setFileName(file.name);
        onUpload(file);
      }
    },
    [onUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setFileName(file.name);
        onUpload(file);
      }
    },
    [onUpload]
  );

  return (
    <div
      className={`file-upload ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="upload-icon">📄</div>
      <p className="upload-text">
        {isLoading
          ? 'Parsing YANG file...'
          : fileName
          ? `Selected: ${fileName}`
          : 'Drag & drop a .yang file here'}
      </p>
      <p className="upload-subtext">or</p>
      <label className="upload-button">
        Browse Files
        <input
          type="file"
          accept=".yang"
          onChange={handleFileSelect}
          hidden
          disabled={isLoading}
        />
      </label>
      {isLoading && <div className="spinner" />}
    </div>
  );
};

export default FileUpload;

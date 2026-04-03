import React, { useCallback, useState } from 'react';

export type YangInput =
  | { type: 'file'; file: File }
  | { type: 'content'; content: string; filename: string }
  | { type: 'filepath'; filepath: string };

interface FileUploadProps {
  onUpload: (input: YangInput) => void;
  isLoading: boolean;
}

type InputMode = 'upload' | 'paste' | 'filepath';

const FileUpload: React.FC<FileUploadProps> = ({ onUpload, isLoading }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mode, setMode] = useState<InputMode>('upload');
  const [pasteContent, setPasteContent] = useState('');
  const [pasteFilename, setPasteFilename] = useState('');
  const [filepath, setFilepath] = useState('');

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      // Check for text content first (dragged YANG content from editor, etc.)
      const textData = e.dataTransfer.getData('text/plain');
      if (textData && textData.trim().length > 0 && !e.dataTransfer.files.length) {
        setMode('paste');
        setPasteContent(textData);
        return;
      }

      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.yang')) {
        setFileName(file.name);
        onUpload({ type: 'file', file });
      }
    },
    [onUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setFileName(file.name);
        onUpload({ type: 'file', file });
      }
    },
    [onUpload]
  );

  const handlePasteSubmit = useCallback(() => {
    if (!pasteContent.trim()) return;
    const filename = pasteFilename.trim() || 'input.yang';
    onUpload({ type: 'content', content: pasteContent, filename });
  }, [pasteContent, pasteFilename, onUpload]);

  const handleFilepathSubmit = useCallback(() => {
    if (!filepath.trim()) return;
    onUpload({ type: 'filepath', filepath: filepath.trim() });
  }, [filepath, onUpload]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, submit: () => void) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        submit();
      }
    },
    []
  );

  return (
    <div className="file-upload-container">
      <div className="input-mode-tabs">
        <button
          className={`mode-tab ${mode === 'upload' ? 'active' : ''}`}
          onClick={() => setMode('upload')}
          disabled={isLoading}
        >
          📁 Upload / Drop
        </button>
        <button
          className={`mode-tab ${mode === 'paste' ? 'active' : ''}`}
          onClick={() => setMode('paste')}
          disabled={isLoading}
        >
          📋 Paste Content
        </button>
        <button
          className={`mode-tab ${mode === 'filepath' ? 'active' : ''}`}
          onClick={() => setMode('filepath')}
          disabled={isLoading}
        >
          📂 Server File Path
        </button>
      </div>

      {mode === 'upload' && (
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
      )}

      {mode === 'paste' && (
        <div className="paste-input">
          <div className="paste-filename-row">
            <label className="paste-label">Module name (optional)</label>
            <input
              type="text"
              className="paste-filename-input"
              placeholder="e.g. my-module.yang"
              value={pasteFilename}
              onChange={(e) => setPasteFilename(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <textarea
            className="paste-textarea"
            placeholder={`Paste your YANG module content here...\n\nmodule example {\n  namespace "urn:example";\n  prefix ex;\n  ...\n}`}
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, handlePasteSubmit)}
            disabled={isLoading}
            rows={12}
          />
          <div className="paste-actions">
            <button
              className="upload-button"
              onClick={handlePasteSubmit}
              disabled={isLoading || !pasteContent.trim()}
            >
              {isLoading ? 'Parsing...' : 'Parse YANG'}
            </button>
            <span className="paste-hint">Ctrl+Enter to submit</span>
          </div>
          {isLoading && <div className="spinner" />}
        </div>
      )}

      {mode === 'filepath' && (
        <div className="filepath-input">
          <p className="filepath-description">
            Enter the path to a <code>.yang</code> file on the server's filesystem.
          </p>
          <div className="filepath-row">
            <input
              type="text"
              className="filepath-text-input"
              placeholder="e.g. C:\models\openconfig-interfaces.yang or /opt/yang/modules/example.yang"
              value={filepath}
              onChange={(e) => setFilepath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFilepathSubmit();
              }}
              disabled={isLoading}
            />
            <button
              className="upload-button"
              onClick={handleFilepathSubmit}
              disabled={isLoading || !filepath.trim()}
            >
              {isLoading ? 'Loading...' : 'Load File'}
            </button>
          </div>
          {isLoading && <div className="spinner" />}
        </div>
      )}
    </div>
  );
};

export default FileUpload;

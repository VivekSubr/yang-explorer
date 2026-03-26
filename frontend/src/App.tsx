import { useState, useCallback } from 'react';
import type { YangSchema } from './types/schema';
import FileUpload from './components/FileUpload';
import SchemaViewer from './components/SchemaViewer';
import './App.css';

function App() {
  const [schema, setSchema] = useState<YangSchema | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setSchema(null);

    try {
      const formData = new FormData();
      formData.append('yangFile', file);

      const response = await fetch('/api/yang/parse', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to parse YANG file');
        return;
      }

      setSchema(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-brand">
            <h1>YANG Explorer</h1>
            <span className="header-subtitle">Interactive YANG Schema Viewer</span>
          </div>
          <a
            href="https://github.com/openconfig/ygot"
            target="_blank"
            rel="noopener noreferrer"
            className="header-link"
          >
            Powered by ygot
          </a>
        </div>
      </header>

      <main className="app-main">
        <FileUpload onUpload={handleUpload} isLoading={isLoading} />

        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {schema && <SchemaViewer schema={schema} />}
      </main>
    </div>
  );
}

export default App;

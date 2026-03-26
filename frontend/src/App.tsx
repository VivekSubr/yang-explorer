import { useState, useCallback } from 'react';
import type { YangSchema, ComplianceResult } from './types/schema';
import FileUpload from './components/FileUpload';
import SchemaViewer from './components/SchemaViewer';
import CompliancePanel from './components/CompliancePanel';
import './App.css';

function App() {
  const [schema, setSchema] = useState<YangSchema | null>(null);
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'schema' | 'compliance'>('schema');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setSchema(null);
    setCompliance(null);
    setUploadedFile(file);

    try {
      const formData = new FormData();
      formData.append('yangFile', file);

      const [schemaRes, complianceRes] = await Promise.all([
        fetch('/api/yang/parse', { method: 'POST', body: formData }),
        fetch('/api/yang/sonic-compliance', {
          method: 'POST',
          body: (() => { const fd = new FormData(); fd.append('yangFile', file); return fd; })(),
        }),
      ]);

      const schemaData = await schemaRes.json();
      const complianceData = await complianceRes.json();

      if (!schemaRes.ok) {
        setError(schemaData.error || 'Failed to parse YANG file');
        return;
      }

      setSchema(schemaData);

      if (complianceRes.ok) {
        setCompliance(complianceData);
      }
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

        {schema && (
          <>
            <div className="tab-bar">
              <button
                className={`tab ${activeTab === 'schema' ? 'active' : ''}`}
                onClick={() => setActiveTab('schema')}
              >
                Schema Explorer
              </button>
              <button
                className={`tab ${activeTab === 'compliance' ? 'active' : ''}`}
                onClick={() => setActiveTab('compliance')}
              >
                SONiC Compliance
                {compliance && (
                  <span className={`tab-badge ${compliance.compliant ? 'badge-pass' : 'badge-fail'}`}>
                    {compliance.score}%
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'schema' && <SchemaViewer schema={schema} />}
            {activeTab === 'compliance' && compliance && <CompliancePanel result={compliance} />}
          </>
        )}
      </main>
    </div>
  );
}

export default App;

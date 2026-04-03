import { useState, useCallback } from 'react';
import type { YangSchema, ComplianceResult, LintResult } from './types/schema';
import FileUpload from './components/FileUpload';
import type { YangInput } from './components/FileUpload';
import SchemaViewer from './components/SchemaViewer';
import CompliancePanel from './components/CompliancePanel';
import LintPanel from './components/LintPanel';
import './App.css';

function buildRequestOptions(input: YangInput): { body: BodyInit; headers?: Record<string, string> } {
  switch (input.type) {
    case 'file': {
      const fd = new FormData();
      fd.append('yangFile', input.file);
      return { body: fd };
    }
    case 'content':
      return {
        body: JSON.stringify({ content: input.content, filename: input.filename }),
        headers: { 'Content-Type': 'application/json' },
      };
    case 'filepath':
      return {
        body: JSON.stringify({ filepath: input.filepath }),
        headers: { 'Content-Type': 'application/json' },
      };
  }
}

function inputLabel(input: YangInput): string {
  switch (input.type) {
    case 'file':
      return input.file.name;
    case 'content':
      return input.filename || 'pasted content';
    case 'filepath':
      return input.filepath;
  }
}

function App() {
  const [schema, setSchema] = useState<YangSchema | null>(null);
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [lint, setLint] = useState<LintResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'schema' | 'compliance' | 'lint'>('schema');
  const [sourceName, setSourceName] = useState<string | null>(null);

  const handleUpload = useCallback(async (input: YangInput) => {
    setIsLoading(true);
    setError(null);
    setSchema(null);
    setCompliance(null);
    setLint(null);
    setSourceName(inputLabel(input));

    try {
      const makeOpts = () => {
        const opts = buildRequestOptions(input);
        return { method: 'POST' as const, body: opts.body, headers: opts.headers };
      };

      const [schemaRes, complianceRes, lintRes] = await Promise.all([
        fetch('/api/yang/parse', makeOpts()),
        fetch('/api/yang/sonic-compliance', makeOpts()),
        fetch('/api/yang/sonic-lint', makeOpts()),
      ]);

      const schemaData = await schemaRes.json();
      const complianceData = await complianceRes.json();
      const lintData = await lintRes.json();

      if (!schemaRes.ok) {
        setError(schemaData.error || 'Failed to parse YANG file');
        return;
      }

      setSchema(schemaData);

      if (complianceRes.ok) {
        setCompliance(complianceData);
      }
      if (lintRes.ok) {
        setLint(lintData);
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
            {sourceName && (
              <div className="source-banner">
                <span className="source-label">Source:</span> <code>{sourceName}</code>
              </div>
            )}
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
              <button
                className={`tab ${activeTab === 'lint' ? 'active' : ''}`}
                onClick={() => setActiveTab('lint')}
              >
                Linter
                {lint && (
                  <span className={`tab-badge ${lint.issues.length === 0 ? 'badge-pass' : 'badge-fail'}`}>
                    {lint.issues.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'schema' && <SchemaViewer schema={schema} />}
            {activeTab === 'compliance' && compliance && <CompliancePanel result={compliance} />}
            {activeTab === 'lint' && lint && <LintPanel result={lint} />}
          </>
        )}
      </main>
    </div>
  );
}

export default App;

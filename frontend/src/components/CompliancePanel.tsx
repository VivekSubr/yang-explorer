import React from 'react';
import type { ComplianceResult } from '../types/schema';

interface CompliancePanelProps {
  result: ComplianceResult;
}

const STATUS_ICONS: Record<string, string> = {
  pass: '✅',
  fail: '❌',
  warning: '⚠️',
};

const CATEGORY_LABELS: Record<string, string> = {
  naming: 'Naming Conventions',
  structure: 'Schema Structure',
  types: 'Type Definitions',
  metadata: 'Module Metadata',
  'sonic-extension': 'SONiC Extensions',
};

const CompliancePanel: React.FC<CompliancePanelProps> = ({ result }) => {
  const categories = [...new Set(result.checks.map((c) => c.category))];

  return (
    <div className="compliance-panel">
      <div className={`compliance-header ${result.compliant ? 'compliant' : 'non-compliant'}`}>
        <div className="compliance-score-ring">
          <svg viewBox="0 0 36 36" className="score-svg">
            <path
              className="score-bg"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="score-fill"
              strokeDasharray={`${result.score}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="score-text">{result.score}</span>
        </div>
        <div className="compliance-summary">
          <h3>{result.compliant ? 'SONiC Compliant' : 'Not SONiC Compliant'}</h3>
          <p>{result.summary}</p>
        </div>
      </div>

      <div className="compliance-checks">
        {categories.map((cat) => (
          <div key={cat} className="compliance-category">
            <h4 className="category-title">{CATEGORY_LABELS[cat] || cat}</h4>
            <div className="check-list">
              {result.checks
                .filter((c) => c.category === cat)
                .map((check, i) => (
                  <div key={`${check.rule}-${i}`} className={`check-item check-${check.status}`}>
                    <span className="check-icon">{STATUS_ICONS[check.status] || '•'}</span>
                    <div className="check-content">
                      <span className="check-message">{check.message}</span>
                      {check.path && <code className="check-path">{check.path}</code>}
                    </div>
                    <span className={`check-badge badge-${check.status}`}>
                      {check.status.toUpperCase()}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompliancePanel;

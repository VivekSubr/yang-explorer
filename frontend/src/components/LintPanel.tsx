import React, { useState } from 'react';
import type { LintResult } from '../types/schema';

interface LintPanelProps {
  result: LintResult;
}

const SEVERITY_ICONS: Record<string, string> = {
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

const SEVERITY_ORDER: Record<string, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const GUIDELINE_URL = 'https://github.com/sonic-net/SONiC/blob/master/doc/mgmt/SONiC_YANG_Model_Guidelines.md';

const LintPanel: React.FC<LintPanelProps> = ({ result }) => {
  const [filter, setFilter] = useState<string>('all');

  const errorCount = result.issues.filter((i) => i.severity === 'error').length;
  const warnCount = result.issues.filter((i) => i.severity === 'warning').length;
  const infoCount = result.issues.filter((i) => i.severity === 'info').length;

  const filtered =
    filter === 'all'
      ? result.issues
      : result.issues.filter((i) => i.severity === filter);

  const sorted = [...filtered].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
  );

  // Group by guideline
  const byGuideline = new Map<number, typeof sorted>();
  for (const issue of sorted) {
    const g = issue.guideline;
    if (!byGuideline.has(g)) byGuideline.set(g, []);
    byGuideline.get(g)!.push(issue);
  }

  return (
    <div className="lint-panel">
      <div className={`lint-header ${errorCount > 0 ? 'has-errors' : 'clean'}`}>
        <div className="lint-stats">
          <div className="lint-stat lint-stat-error" onClick={() => setFilter(filter === 'error' ? 'all' : 'error')}>
            <span className="lint-stat-count">{errorCount}</span>
            <span className="lint-stat-label">Errors</span>
          </div>
          <div className="lint-stat lint-stat-warning" onClick={() => setFilter(filter === 'warning' ? 'all' : 'warning')}>
            <span className="lint-stat-count">{warnCount}</span>
            <span className="lint-stat-label">Warnings</span>
          </div>
          <div className="lint-stat lint-stat-info" onClick={() => setFilter(filter === 'info' ? 'all' : 'info')}>
            <span className="lint-stat-count">{infoCount}</span>
            <span className="lint-stat-label">Info</span>
          </div>
        </div>
        <div className="lint-summary">
          <p>{result.summary}</p>
          <a href={GUIDELINE_URL} target="_blank" rel="noopener noreferrer" className="lint-guidelines-link">
            SONiC YANG Model Guidelines ↗
          </a>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="lint-empty">
          <span className="lint-empty-icon">✅</span>
          <p>No issues found — great job!</p>
        </div>
      ) : (
        <div className="lint-issues">
          {[...byGuideline.entries()].map(([guideline, issues]) => (
            <div key={guideline} className="lint-guideline-group">
              <h4 className="lint-guideline-title">
                Guideline #{guideline}
              </h4>
              {issues.map((issue, i) => (
                <div key={`${issue.rule}-${i}`} className={`lint-issue lint-${issue.severity}`}>
                  <span className="lint-issue-icon">{SEVERITY_ICONS[issue.severity] || '•'}</span>
                  <div className="lint-issue-content">
                    <div className="lint-issue-message">{issue.message}</div>
                    {issue.path && <code className="lint-issue-path">{issue.path}</code>}
                    {issue.suggestion && (
                      <div className="lint-issue-suggestion">
                        💡 {issue.suggestion}
                      </div>
                    )}
                  </div>
                  <span className={`lint-severity-badge severity-${issue.severity}`}>
                    {issue.severity.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LintPanel;

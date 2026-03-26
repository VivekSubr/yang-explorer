import React, { useState } from 'react';
import type { SchemaNode as SchemaNodeType, YangType } from '../types/schema';

interface SchemaNodeProps {
  node: SchemaNodeType;
  depth: number;
}

const KIND_COLORS: Record<string, string> = {
  container: '#49cc90',
  list: '#61affe',
  leaf: '#fca130',
  'leaf-list': '#f93e3e',
  choice: '#9012fe',
  case: '#50e3c2',
  rpc: '#e040fb',
  notification: '#ff6d00',
  input: '#00bcd4',
  output: '#8bc34a',
  grouping: '#795548',
  uses: '#607d8b',
  typedef: '#ff5722',
  identity: '#3f51b5',
  anyxml: '#9e9e9e',
  anydata: '#9e9e9e',
};

const KIND_BG_COLORS: Record<string, string> = {
  container: 'rgba(73, 204, 144, 0.1)',
  list: 'rgba(97, 175, 254, 0.1)',
  leaf: 'rgba(252, 161, 48, 0.1)',
  'leaf-list': 'rgba(249, 62, 62, 0.1)',
  choice: 'rgba(144, 18, 254, 0.1)',
  case: 'rgba(80, 227, 194, 0.1)',
  rpc: 'rgba(224, 64, 251, 0.1)',
};

function getKindColor(kind: string): string {
  return KIND_COLORS[kind] || '#999';
}

function getKindBgColor(kind: string): string {
  return KIND_BG_COLORS[kind] || 'rgba(153, 153, 153, 0.1)';
}

const TypeDisplay: React.FC<{ type: YangType }> = ({ type }) => {
  if (type.enums && type.enums.length > 0) {
    return (
      <span className="type-info">
        <span className="type-name">enumeration</span>
        <span className="type-detail">
          [{type.enums.map((e) => e.name).join(', ')}]
        </span>
      </span>
    );
  }

  if (type.unionTypes && type.unionTypes.length > 0) {
    return (
      <span className="type-info">
        <span className="type-name">union</span>
        <span className="type-detail">
          ({type.unionTypes.map((t) => t.name || t.base).join(' | ')})
        </span>
      </span>
    );
  }

  return (
    <span className="type-info">
      <span className="type-name">{type.name}</span>
      {type.range && <span className="type-constraint">range: {type.range}</span>}
      {type.length && <span className="type-constraint">length: {type.length}</span>}
      {type.pattern && <span className="type-constraint">pattern: {type.pattern}</span>}
      {type.path && <span className="type-constraint">path: {type.path}</span>}
    </span>
  );
};

const SchemaNode: React.FC<SchemaNodeProps> = ({ node, depth }) => {
  const hasChildren = node.children && node.children.length > 0;
  const [isExpanded, setIsExpanded] = useState(depth < 2);

  const kindColor = getKindColor(node.kind);
  const kindBgColor = getKindBgColor(node.kind);

  return (
    <div className="schema-node" style={{ '--node-color': kindColor, '--node-bg': kindBgColor } as React.CSSProperties}>
      <div
        className={`node-header ${hasChildren ? 'expandable' : ''} ${isExpanded ? 'expanded' : ''}`}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        <div className="node-header-left">
          {hasChildren && (
            <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
          )}
          <span className="node-badge" style={{ backgroundColor: kindColor }}>
            {node.kind.toUpperCase()}
          </span>
          <span className="node-name">{node.name}</span>
          {node.type && <TypeDisplay type={node.type} />}
        </div>
        <div className="node-header-right">
          {node.mandatory && <span className="tag tag-required">required</span>}
          {node.config === false && <span className="tag tag-readonly">read-only</span>}
          {node.config === true && <span className="tag tag-config">config</span>}
          {node.key && <span className="tag tag-key">key: {node.key}</span>}
          {node.default && <span className="tag tag-default">default: {node.default}</span>}
        </div>
      </div>

      {(isExpanded || !hasChildren) && (
        <div className="node-details">
          {node.description && (
            <p className="node-description">{node.description}</p>
          )}
          {node.type?.enums && node.type.enums.length > 0 && (
            <div className="enum-table">
              <table>
                <thead>
                  <tr>
                    <th>Value</th>
                    <th>Name</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {node.type.enums.map((e) => (
                    <tr key={e.name}>
                      <td>{e.value ?? '-'}</td>
                      <td><code>{e.name}</code></td>
                      <td>{e.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {node.path && (
            <div className="node-path">
              <span className="path-label">Path:</span> <code>{node.path}</code>
            </div>
          )}
        </div>
      )}

      {isExpanded && hasChildren && (
        <div className="node-children">
          {node.children!.map((child) => (
            <SchemaNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SchemaNode;

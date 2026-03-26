import React from 'react';
import type { YangSchema } from '../types/schema';
import SchemaNode from './SchemaNode';

interface SchemaViewerProps {
  schema: YangSchema;
}

const SchemaViewer: React.FC<SchemaViewerProps> = ({ schema }) => {
  return (
    <div className="schema-viewer">
      <div className="schema-header">
        <div className="schema-title-row">
          <h2 className="schema-title">{schema.module}</h2>
          {schema.revision && (
            <span className="schema-version">{schema.revision}</span>
          )}
        </div>
        {schema.description && (
          <p className="schema-description">{schema.description}</p>
        )}
        <div className="schema-meta">
          {schema.namespace && (
            <div className="meta-item">
              <span className="meta-label">Namespace</span>
              <span className="meta-value">{schema.namespace}</span>
            </div>
          )}
          {schema.prefix && (
            <div className="meta-item">
              <span className="meta-label">Prefix</span>
              <span className="meta-value">{schema.prefix}</span>
            </div>
          )}
          {schema.organization && (
            <div className="meta-item">
              <span className="meta-label">Organization</span>
              <span className="meta-value">{schema.organization}</span>
            </div>
          )}
          {schema.contact && (
            <div className="meta-item">
              <span className="meta-label">Contact</span>
              <span className="meta-value">{schema.contact}</span>
            </div>
          )}
        </div>
      </div>

      <div className="schema-tree">
        {schema.children?.map((child) => (
          <SchemaNode key={child.path} node={child} depth={0} />
        ))}
      </div>
    </div>
  );
};

export default SchemaViewer;

// Dev-only YANG parser server. Usage: node dev-server.js
// Core functions are also used by mcp-server.js
const http = require('http');
const { exec } = require('child_process');
const PORT = 8080;
const FRONTEND_PORT = 5173;

function parseYang(content, filename) {
  const mod = extract(content, /^\s*module\s+([\w-]+)/m) || filename.replace('.yang','');
  return {
    module: mod,
    namespace: extract(content, /namespace\s+"([^"]+)"/),
    prefix: extract(content, /prefix\s+([\w-]+)\s*;/) || extract(content, /prefix\s+"([^"]+)"/),
    description: extractDesc(content, 0),
    organization: extract(content, /organization\s+"([^"]+)"/),
    contact: extract(content, /contact\s+"([^"]+)"/),
    revision: extract(content, /revision\s+([\d-]+)/),
    children: parseBlock(content, '/' + mod, 0),
  };
}

function extract(s, re) { const m = s.match(re); return m ? m[1] : ''; }

function extractDesc(block) {
  // Multi-line: description\n   "..."
  let m = block.match(/description\s*\n\s*"([\s\S]*?)";/);
  if (m) return m[1].replace(/\s+/g, ' ').trim();
  // Single line: description "...";
  m = block.match(/description\s+"([^"]+)"/);
  return m ? m[1] : '';
}

function findBlocks(content, parentDepth) {
  const blocks = [];
  const lines = content.split('\n');
  let depth = 0, collecting = false, blockLines = [], blockKind = '', blockName = '', startDepth = 0;

  for (const line of lines) {
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;

    if (!collecting && depth === parentDepth + 1) {
      const m = line.match(/^\s*(container|list|leaf-list|leaf|choice|rpc|notification|grouping|typedef|uses|augment|anyxml|anydata)\s+([\w-]+)/);
      if (m) {
        collecting = true;
        blockKind = m[1]; blockName = m[2];
        blockLines = [line]; startDepth = depth;
      }
    } else if (collecting) {
      blockLines.push(line);
    }

    depth += opens - closes;

    if (collecting && depth <= startDepth) {
      blocks.push({ kind: blockKind, name: blockName, content: blockLines.join('\n') });
      collecting = false; blockLines = [];
    }
  }
  return blocks;
}

function parseBlock(content, parentPath, depth) {
  const blocks = findBlocks(content, depth);
  return blocks.map(b => {
    const path = parentPath + '/' + b.name;
    const node = {
      name: b.name,
      kind: b.kind,
      path: path,
      description: extractDesc(b.content),
    };

    // Type
    const typeM = b.content.match(/type\s+([\w-]+)\s*[{;]/);
    if (typeM && (b.kind === 'leaf' || b.kind === 'leaf-list')) {
      const t = { name: typeM[1] };
      // Range
      const rangeM = b.content.match(/range\s+"([^"]+)"/);
      if (rangeM) t.range = rangeM[1];
      // Length
      const lenM = b.content.match(/length\s+"([^"]+)"/);
      if (lenM) t.length = lenM[1];
      // Enums
      if (typeM[1] === 'enumeration') {
        const enums = [];
        const enumRe = /enum\s+([\w-]+)\s*\{[^}]*?(?:value\s+(\d+))?/g;
        let em;
        while ((em = enumRe.exec(b.content)) !== null) {
          enums.push({ name: em[1], value: em[2] ? parseInt(em[2]) : undefined });
        }
        if (enums.length) t.enums = enums;
      }
      node.type = t;
    }

    // Key
    const keyM = b.content.match(/key\s+"([^"]+)"/);
    if (keyM) node.key = keyM[1];

    // Default
    const defM = b.content.match(/default\s+"([^"]+)"/);
    if (defM) node.default = defM[1];

    // Mandatory
    if (b.content.match(/mandatory\s+true/)) node.mandatory = true;

    // Config
    if (b.content.match(/config\s+false/)) node.config = false;
    else if (b.content.match(/config\s+true/)) node.config = true;

    // Recurse into children for containers and lists
    if (b.kind === 'container' || b.kind === 'list' || b.kind === 'choice' || b.kind === 'rpc') {
      node.children = parseBlock(b.content, path, 0);
    }

    return node;
  });
}

// In-memory store for the latest parsed result
let latestResult = null;
// SSE clients for real-time push
const sseClients = [];

function broadcastResult(result) {
  const data = `data: ${JSON.stringify(result)}\n\n`;
  for (const client of sseClients) {
    client.write(data);
  }
}

function openBrowser(url) {
  const platform = process.platform;
  const cmd = platform === 'win32' ? 'start' : platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${cmd} ${url}`);
}

// Open browser and push result once a client connects
function ensureFrontend() {
  if (sseClients.length > 0) {
    broadcastResult(latestResult);
  } else {
    openBrowser(`http://localhost:${FRONTEND_PORT}`);
    // Wait for the SSE client to connect, then push
    const waitForClient = setInterval(() => {
      if (sseClients.length > 0) {
        clearInterval(waitForClient);
        broadcastResult(latestResult);
      }
    }, 500);
    // Give up after 30s
    setTimeout(() => clearInterval(waitForClient), 30000);
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Filename');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.url === '/api/health') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end('{"status":"ok"}'); return;
  }

  if (req.url === '/api/yang/latest' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify(latestResult || {})); return;
  }

  if (req.url === '/api/yang/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('\n');
    sseClients.push(res);
    req.on('close', () => {
      const idx = sseClients.indexOf(res);
      if (idx >= 0) sseClients.splice(idx, 1);
    });
    return;
  }

  if ((req.url === '/api/yang/parse' || req.url === '/api/yang/sonic-compliance' || req.url === '/api/yang/sonic-lint') && req.method === 'POST') {
    const isCompliance = req.url === '/api/yang/sonic-compliance';
    const isLint = req.url === '/api/yang/sonic-lint';
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const ct = req.headers['content-type'] || '';
      let yangContent = '', filename = 'input.yang';

      if (ct.includes('multipart/form-data')) {
        const boundary = ct.split('boundary=')[1];
        if (boundary) {
          const parts = body.toString().split('--' + boundary);
          for (const part of parts) {
            if (part.includes('name="yangFile"')) {
              const fm = part.match(/filename="([^"]+)"/);
              if (fm) filename = fm[1];
              const cs = part.indexOf('\r\n\r\n');
              if (cs !== -1) yangContent = part.substring(cs + 4).replace(/\r\n--$/, '').trim();
            }
          }
        }
      } else if (ct.includes('application/json')) {
        try {
          const json = JSON.parse(body.toString());
          if (json.filepath) {
            const path = require('path');
            const fs = require('fs');
            const resolved = path.resolve(json.filepath);
            yangContent = fs.readFileSync(resolved, 'utf-8');
            filename = path.basename(resolved);
          } else if (json.content) {
            yangContent = json.content;
            filename = json.filename || 'input.yang';
          }
        } catch (e) {
          res.writeHead(400, {'Content-Type':'application/json'});
          res.end(JSON.stringify({error: 'Invalid JSON: ' + e.message}));
          return;
        }
      } else {
        yangContent = body.toString();
        filename = req.headers['x-filename'] || 'input.yang';
      }

      if (!yangContent) {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'No YANG content found'})); return;
      }

      try {
        const schema = parseYang(yangContent, filename);
        const compliance = checkSonicCompliance(schema);
        const lint = lintSonicYang(schema, yangContent);
        latestResult = { schema, compliance, lint, sourceName: filename };

        if (isCompliance) {
          res.writeHead(200, {'Content-Type':'application/json'});
          res.end(JSON.stringify(compliance));
        } else if (isLint) {
          res.writeHead(200, {'Content-Type':'application/json'});
          res.end(JSON.stringify(lint));
        } else {
          res.writeHead(200, {'Content-Type':'application/json'});
          res.end(JSON.stringify(schema));
        }

        ensureFrontend();
      } catch(e) {
        res.writeHead(422, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'Parse error: ' + e.message}));
      }
    });
    return;
  }

  res.writeHead(404, {'Content-Type':'application/json'});
  res.end('{"error":"Not found"}');
});

function lintSonicYang(schema, rawContent) {
  const issues = [];
  const mod = schema.module || '';

  // G1: Module naming — must start with sonic- prefix
  if (!mod.startsWith('sonic-')) {
    issues.push({ rule: 'sonic-module-prefix', guideline: 1, severity: 'error',
      message: `Module name '${mod}' must use 'sonic-' prefix`,
      suggestion: `Rename to 'sonic-${mod}'` });
  }
  if (mod !== mod.toLowerCase()) {
    issues.push({ rule: 'module-lowercase', guideline: 1, severity: 'error',
      message: `Module name '${mod}' must be lowercase`,
      suggestion: `Rename to '${mod.toLowerCase()}'` });
  }
  if (mod.includes('_')) {
    issues.push({ rule: 'module-no-underscore', guideline: 1, severity: 'error',
      message: `Module name '${mod}' should use hyphens, not underscores`,
      suggestion: `Rename to '${mod.replace(/_/g, '-')}'` });
  }

  // G2: Top-level container must match module name
  const topContainers = (schema.children || []).filter(c => c.kind === 'container');
  if (topContainers.length === 0) {
    issues.push({ rule: 'top-container-required', guideline: 2, severity: 'error',
      message: 'SONiC YANG modules must have a top-level container',
      suggestion: `Add 'container ${mod} { ... }'` });
  } else {
    for (const tc of topContainers) {
      if (tc.name !== mod) {
        issues.push({ rule: 'top-container-name', guideline: 2, severity: 'warning',
          message: `Top-level container '${tc.name}' should match module name '${mod}'`,
          path: tc.path,
          suggestion: `Rename container to '${mod}'` });
      }
    }
  }

  // G3: Namespace format
  const ns = schema.namespace || '';
  if (ns && !ns.startsWith('http://github.com/sonic-net/')) {
    issues.push({ rule: 'namespace-format', guideline: 3, severity: 'warning',
      message: `Namespace '${ns}' should start with 'http://github.com/sonic-net/'`,
      suggestion: `Use 'http://github.com/sonic-net/sonic-${mod}'` });
  }
  if (!ns) {
    issues.push({ rule: 'namespace-required', guideline: 3, severity: 'error',
      message: 'Module must define a namespace' });
  }

  // G4: Revision
  if (!schema.revision) {
    issues.push({ rule: 'revision-required', guideline: 4, severity: 'error',
      message: 'Module must have at least one revision statement',
      suggestion: 'Add revision YYYY-MM-DD { description "Initial revision"; }' });
  }

  // G5/G17: Table containers must have _LIST suffix list
  function checkTableStructure(nodes, parentPath) {
    for (const node of (nodes || [])) {
      const path = parentPath + '/' + node.name;
      if (node.kind === 'container') {
        const childLists = (node.children || []).filter(c => c.kind === 'list');
        if (childLists.length > 0) {
          for (const list of childLists) {
            const expected = node.name + '_LIST';
            if (list.name !== expected) {
              issues.push({ rule: 'list-name-suffix', guideline: 5, severity: 'warning',
                message: `List '${list.name}' inside container '${node.name}' should be named '${expected}'`,
                path: path + '/' + list.name,
                suggestion: `Rename list to '${expected}'` });
            }
          }
        }
      }
      // G9: List keys
      if (node.kind === 'list' && !node.key) {
        issues.push({ rule: 'list-key-required', guideline: 9, severity: 'error',
          message: `List '${node.name}' must define a key`,
          path });
      }
      checkTableStructure(node.children, path);
    }
  }
  checkTableStructure(schema.children, '');

  // G14: Error messages on constraints (check raw content)
  const mustPatterns = rawContent.match(/must\s+"[^"]+"\s*\{/g) || [];
  for (const mp of mustPatterns) {
    if (!rawContent.includes('error-message')) {
      issues.push({ rule: 'must-error-message', guideline: 14, severity: 'info',
        message: 'must constraints should include error-message statements',
        suggestion: 'Add error-message "..." inside must constraint blocks' });
      break;
    }
  }

  // G16: Comments on constraints
  const patternRe = /pattern\s+"([^"]+)"/g;
  let pm;
  while ((pm = patternRe.exec(rawContent)) !== null) {
    const lineIdx = rawContent.substring(0, pm.index).split('\n').length;
    const prevLines = rawContent.split('\n').slice(Math.max(0, lineIdx - 3), lineIdx);
    const hasComment = prevLines.some(l => l.includes('//') || l.includes('/*'));
    if (!hasComment) {
      issues.push({ rule: 'pattern-comment', guideline: 16, severity: 'info',
        message: `Pattern '${pm[1].substring(0, 30)}...' should have a comment explaining its purpose`,
        suggestion: 'Add a comment above the pattern explaining what it validates' });
    }
  }

  // Calculate score
  const total = issues.length > 0 ? issues.length : 1;
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warning').length;
  const score = Math.max(0, Math.round(100 - (errorCount * 10 + warnCount * 5 + (issues.length - errorCount - warnCount) * 2)));
  const summary = issues.length === 0
    ? 'No linting issues found — module follows SONiC YANG guidelines'
    : `Found ${issues.length} issue(s): ${errorCount} error(s), ${warnCount} warning(s), ${issues.length - errorCount - warnCount} info`;

  return { score, summary, issues };
}

function checkSonicCompliance(schema) {
  const checks = [];
  const mod = schema.module || '';

  // Module naming
  checks.push({
    rule: 'module-lowercase', category: 'naming',
    status: mod === mod.toLowerCase() ? 'pass' : 'fail',
    message: mod === mod.toLowerCase() ? 'Module name is lowercase' : `Module name '${mod}' should be lowercase`,
  });
  checks.push({
    rule: 'module-hyphen-separator', category: 'naming',
    status: mod.includes('_') ? 'fail' : 'pass',
    message: mod.includes('_') ? 'Module name should use hyphens, not underscores' : 'Module name uses hyphens as separators',
  });
  checks.push({
    rule: 'sonic-prefix', category: 'naming',
    status: mod.startsWith('sonic-') ? 'pass' : 'warning',
    message: mod.startsWith('sonic-') ? "Module has 'sonic-' prefix" : `Module '${mod}' does not have 'sonic-' prefix`,
  });

  // Metadata
  const metaChecks = [
    { field: 'namespace', rule: 'namespace-present' },
    { field: 'prefix', rule: 'prefix-present' },
    { field: 'revision', rule: 'revision-present' },
  ];
  for (const mc of metaChecks) {
    checks.push({
      rule: mc.rule, category: 'metadata',
      status: schema[mc.field] ? 'pass' : 'fail',
      message: schema[mc.field] ? `${mc.field} defined: ${schema[mc.field]}` : `Module must have a ${mc.field}`,
    });
  }
  checks.push({
    rule: 'description-present', category: 'metadata',
    status: schema.description ? 'pass' : 'warning',
    message: schema.description ? 'Module has a description' : 'Module should have a description',
  });

  // Node checks
  function checkNodes(nodes, parentPath) {
    for (const node of (nodes || [])) {
      const path = parentPath + '/' + node.name;
      if (node.kind === 'list' && !node.key) {
        checks.push({ rule: 'list-has-key', category: 'structure', status: 'fail', message: `List '${node.name}' must define a key`, path });
      } else if (node.kind === 'list') {
        checks.push({ rule: 'list-has-key', category: 'structure', status: 'pass', message: `List '${node.name}' has key: ${node.key}`, path });
      }
      if (node.name !== node.name.toLowerCase()) {
        checks.push({ rule: 'node-lowercase', category: 'naming', status: 'fail', message: `Node name '${node.name}' should be lowercase`, path });
      }
      if (parentPath === '' && node.kind === 'container') {
        const hasList = (node.children || []).some(c => c.kind === 'list');
        checks.push({
          rule: 'container-has-list', category: 'sonic-extension',
          status: hasList ? 'pass' : 'warning',
          message: hasList ? `Container '${node.name}' has list children` : `Container '${node.name}' has no list children`, path,
        });
        checks.push({
          rule: 'top-container-configurable', category: 'sonic-extension',
          status: node.config === false ? 'warning' : 'pass',
          message: node.config === false ? `Container '${node.name}' is read-only` : `Container '${node.name}' is configurable`, path,
        });
      }
      checkNodes(node.children, path);
    }
  }
  checkNodes(schema.children, '');

  const passed = checks.filter(c => c.status === 'pass').length;
  const total = checks.length;
  const score = total > 0 ? Math.round((passed * 100) / total) : 0;
  const hasFail = checks.some(c => c.status === 'fail');
  const compliant = score >= 70 && !hasFail;

  return {
    compliant, score,
    summary: `${passed}/${total} checks passed (score: ${score}%) — ${compliant ? 'SONiC compliant' : 'not SONiC compliant'}`,
    checks,
  };
}

// Only start server when run directly (not when required as module)
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Dev YANG Explorer API on http://localhost:${PORT}`);
    console.log('Note: This is a simplified parser. Use the Go backend for full YANG support.');
  });
}

// Export core functions for MCP server
module.exports = { parseYang, checkSonicCompliance, lintSonicYang };

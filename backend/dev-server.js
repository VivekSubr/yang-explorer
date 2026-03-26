// Dev-only YANG parser server. Usage: node dev-server.js
const http = require('http');
const PORT = 8080;

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

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Filename');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.url === '/api/health') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end('{"status":"ok"}'); return;
  }

  if (req.url === '/api/yang/parse' && req.method === 'POST') {
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
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify(schema));
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

server.listen(PORT, () => {
  console.log(`Dev YANG Explorer API on http://localhost:${PORT}`);
  console.log('Note: This is a simplified parser. Use the Go backend for full YANG support.');
});

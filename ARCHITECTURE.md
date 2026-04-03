# YANG Explorer — Architecture

## Overview

YANG Explorer is an interactive YANG schema viewer with a Go backend (using [ygot/goyang](https://github.com/openconfig/ygot)) and React frontend. Users can submit YANG files via API, MCP tools, or drag-and-drop upload — and explore the parsed schema in a Swagger-like UI.

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       External Callers                      │
│  (curl, MCP client, AI assistant, CLI tool)                 │
└────────────┬──────────────────────────────┬─────────────────┘
             │ POST /api/yang/parse         │ MCP (stdio)
             │ (file, content, or filepath) │ parse_yang
             ▼                              ▼
┌────────────────────────────────────────────────────────────┐
│                        Backend (:8080)                      │
│                                                             │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐ │
│  │  HTTP Server  │  │  MCP Server   │  │   YANG Parser    │ │
│  │  (Go / Node)  │  │  (Node stdio) │  │  (goyang / JS)   │ │
│  └──────┬───────┘  └───────┬───────┘  └────────▲─────────┘ │
│         │                  │                    │           │
│         │    ┌─────────────┴────────────────────┘           │
│         │    │  Shared parse/compliance/lint logic           │
│         │    └─────────────┬────────────────────┐           │
│         │                  │                    │           │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌─────────▼────────┐ │
│  │ Parse Handler │  │  Compliance  │  │   Lint Handler   │ │
│  │ POST /parse   │  │  POST /sonic │  │  POST /sonic-lint│ │
│  └──────┬───────┘  │  -compliance │  └─────────┬────────┘ │
│         │          └──────┬───────┘            │           │
│         │                 │                    │           │
│         └────────┬────────┴────────────────────┘           │
│                  ▼                                          │
│         ┌──────────────┐                                    │
│         │ latestResult  │  In-memory store for last parse   │
│         │   (schema,    │  → served via GET /api/yang/latest│
│         │  compliance,  │  → pushed via WebSocket (planned) │
│         │  lint, source)│                                   │
│         └──────┬───────┘                                    │
│                │                                            │
└────────────────┼────────────────────────────────────────────┘
                 │
                 │  SSE push (GET /api/yang/events)
                 │  Auto-opens browser if no client connected
                 ▼
┌────────────────────────────────────────────────────────────┐
│                      Frontend (:5173)                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                     App.tsx                          │   │
│  │  state: schema, compliance, lint, sourceName        │   │
│  │  SSE listener: /api/yang/events                     │   │
│  │                                                     │   │
│  │  ┌─ No schema pushed? ──────────────────────────┐  │   │
│  │  │         FileUpload (drag-and-drop)            │  │   │
│  │  │  Accepts: file upload, paste, filepath        │  │   │
│  │  │  Sends YANG → backend → receives JSON         │  │   │
│  │  └──────────────────────────────────────────────-┘  │   │
│  │                                                     │   │
│  │  ┌─ Schema loaded? ─────────────────────────────┐  │   │
│  │  │  Tab Bar: Schema | Compliance | Linter       │  │   │
│  │  │  ┌─────────────┐ ┌───────────┐ ┌──────────┐ │  │   │
│  │  │  │SchemaViewer │ │Compliance │ │LintPanel │ │  │   │
│  │  │  │ └SchemaNode │ │  Panel    │ │          │ │  │   │
│  │  │  │  (recursive)│ │           │ │          │ │  │   │
│  │  │  └─────────────┘ └───────────┘ └──────────┘ │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

## Data Flow

YANG always flows through the backend. The frontend never parses YANG — it is a pure JSON viewer.

### Flow 1: External POST → SSE Push (primary)

An external caller (curl, MCP, script) POSTs YANG to the backend. The backend parses it, stores the result, and pushes it to the frontend via SSE. If no browser is open, the backend auto-launches one.

```
curl/MCP ──POST──▶ Backend ──parse──▶ store latestResult
                                            │
                   No browser? ─── open browser ──▶ Frontend connects SSE
                                            │
                   Frontend ◀───SSE push────┘
                   (displays schema immediately)
```

### Flow 2: Manual Upload via FileUpload

If the frontend opens with no schema pushed, it shows the FileUpload screen. The user uploads YANG through the browser, which sends it to the backend for parsing.

```
User opens browser ──▶ Frontend (no schema) ──▶ show FileUpload
                                                       │
                       User drops .yang file ──────────┘
                              │
                       POST /api/yang/parse ──▶ Backend ──▶ JSON response ──▶ display
```

## API Endpoints

| Endpoint | Method | Input | Output |
|----------|--------|-------|--------|
| `/api/yang/parse` | POST | YANG file (multipart), content (JSON), or filepath (JSON) | Parsed `YangSchema`. Pushes result via SSE; opens browser if needed. |
| `/api/yang/sonic-compliance` | POST | Same as parse | `ComplianceResult` with score and checks |
| `/api/yang/sonic-lint` | POST | Same as parse | `LintResult` with issues and suggestions |
| `/api/yang/events` | GET | — | SSE stream. Backend pushes parsed results to connected clients in real-time. |
| `/api/yang/latest` | GET | — | Last parsed result (schema + compliance + lint) |
| `/api/health` | GET | — | `{"status":"ok"}` |

### Input Formats (POST endpoints)

```jsonc
// 1. Content-based (JSON body)
{ "content": "module foo { ... }", "filename": "foo.yang" }

// 2. Filepath-based (JSON body, relative to backend cwd)
{ "filepath": "testdata/example-system.yang" }

// 3. File upload (multipart/form-data, field: "yangFile")
```

## Key Types

```typescript
interface YangSchema {
  module: string;
  namespace?: string;
  prefix?: string;
  description?: string;
  revision?: string;
  organization?: string;
  contact?: string;
  children: SchemaNode[];
}

interface SchemaNode {
  name: string;
  kind: 'container' | 'list' | 'leaf' | 'leaf-list' | 'typedef' | 'choice' | ...;
  path: string;
  description?: string;
  type?: YangType;
  config?: boolean;
  mandatory?: boolean;
  key?: string;
  default?: string;
  children?: SchemaNode[];
}
```

## Component Structure

```
App.tsx
├── FileUpload.tsx        # Drag-and-drop / paste / filepath input
├── SchemaViewer.tsx       # Module header + metadata
│   └── SchemaNode.tsx     # Recursive tree node renderer
├── CompliancePanel.tsx    # SONiC compliance score + checks
└── LintPanel.tsx          # Linter issues + suggestions
```

## Backend Variants

| Variant | Command | Parser | Notes |
|---------|---------|--------|-------|
| **Go backend** | `make dev-backend` | ygot/goyang | Full YANG support, production-grade |
| **Node dev server** | `make dev-mock` | Regex-based JS | Simplified, no Go required |
| **MCP server** | `node backend/mcp-server.js` | Reuses dev-server.js | stdio transport for AI assistants |

The Node dev server (`dev-server.js`) exports `parseYang`, `checkSonicCompliance`, and `lintSonicYang` — shared by both the HTTP server and MCP server.

## MCP Integration

The MCP server exposes three tools over stdio (JSON-RPC):

| Tool | Description |
|------|-------------|
| `parse_yang` | Parse YANG content → schema tree |
| `check_sonic_compliance` | Check SONiC compliance → score + checks |
| `lint_sonic_yang` | Lint against SONiC guidelines → issues |

Configure in any MCP client:
```json
{
  "mcpServers": {
    "yang-explorer": {
      "command": "node",
      "args": ["backend/mcp-server.js"]
    }
  }
}
```

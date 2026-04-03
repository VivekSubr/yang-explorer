# YANG Explorer

Interactive YANG schema viewer with a Go backend (using [ygot/goyang](https://github.com/openconfig/ygot)) and React frontend.

Send a `.yang` file to the backend and explore its parsed schema in a Swagger-like UI — with collapsible trees, color-coded node types, type details, and metadata.

## Data Flow

YANG always flows through the backend — the frontend is a pure JSON viewer.

```
                          ┌──────────────┐
  curl / MCP / script ──▶ │   Backend    │ ──SSE push──▶ Frontend (auto-opens)
                          │  (:8080)     │
  FileUpload (browser) ──▶│  parses YANG │ ──JSON resp──▶ Frontend (displays)
                          └──────────────┘
```

**Two ways to visualize YANG:**

1. **POST to backend** — `curl`, MCP tool, or any HTTP client sends YANG to the backend. The backend parses it, opens the browser if needed, and pushes the result to the frontend via Server-Sent Events (SSE).

2. **Upload in browser** — drag-and-drop, paste, or enter a server filepath in the FileUpload UI. The frontend sends YANG to the backend, receives parsed JSON, and displays it.

## Project Structure

```
├── backend/
│   ├── main.go              # HTTP server entry point
│   ├── handlers/             # API handlers (parse, compliance, lint)
│   ├── parser/               # YANG parser, SONiC compliance & linter
│   ├── models/               # Schema, compliance, lint data models
│   ├── testdata/             # Sample YANG files
│   ├── dev-server.js         # Node.js dev server with SSE push
│   ├── mcp-server.js         # MCP server (stdio transport)
│   └── main_test.go          # Test-based server runner
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Main app with SSE listener + viewer
│   │   ├── components/
│   │   │   ├── FileUpload.tsx      # Drag-and-drop file upload
│   │   │   ├── SchemaViewer.tsx    # Module header + tree root
│   │   │   ├── SchemaNode.tsx      # Recursive schema node renderer
│   │   │   ├── CompliancePanel.tsx # SONiC compliance results
│   │   │   └── LintPanel.tsx       # SONiC linter results
│   │   └── types/
│   │       └── schema.ts          # TypeScript type definitions
│   └── vite.config.ts        # Vite config with API proxy
├── mcp.json                  # MCP server configuration
├── ARCHITECTURE.md           # Detailed architecture documentation
```

## Quick Start

### Prerequisites
- Go 1.21+ 
- Node.js 18+
- Make

### Install all dependencies

```bash
make install
```

### Development (two terminals)

```bash
make dev-backend     # Go API on :8080
make dev-frontend    # React on :5173 (proxies API to :8080)
```

### Alternative: Dev Server (no Go required)

```bash
make dev-mock        # Node.js API on :8080
make dev-frontend    # React on :5173
```

### Visualize a YANG file (from CLI)

With both servers running, POST YANG content to the backend — it will auto-open the browser and display the schema:

```bash
# By file content
curl -X POST http://localhost:8080/api/yang/parse \
  -H "Content-Type: application/json" \
  -d '{"content": "module test { ... }", "filename": "test.yang"}'

# By server filepath
curl -X POST http://localhost:8080/api/yang/parse \
  -H "Content-Type: application/json" \
  -d '{"filepath": "testdata/example-system.yang"}'

# By file upload
curl -X POST http://localhost:8080/api/yang/parse \
  -F "yangFile=@path/to/module.yang"
```

### Production Build

```bash
make build           # Builds Go binary + React static files
```

### Clean

```bash
make clean           # Removes node_modules, go.sum, build artifacts
```

## API

### `POST /api/yang/parse`
Send YANG content (JSON body, multipart file, or filepath) and receive the parsed schema as JSON. Triggers SSE push to connected frontends; opens browser if none connected.

### `POST /api/yang/sonic-compliance`
Send YANG content and check SONiC compliance. Returns score, pass/fail checks by category.

### `POST /api/yang/sonic-lint`
Send YANG content and lint it against [SONiC YANG Model Guidelines](https://github.com/sonic-net/SONiC/blob/master/doc/mgmt/SONiC_YANG_Model_Guidelines.md). Returns issues with severity, guideline numbers, and suggestions.

### `GET /api/yang/events`
Server-Sent Events endpoint. The backend pushes parsed results (schema + compliance + lint) to all connected clients in real-time.

### `GET /api/yang/latest`
Returns the last parsed result (schema + compliance + lint + source name).

### `GET /api/health`
Returns `{"status":"ok"}`.

## MCP Server

The backend APIs are also available as an [MCP](https://modelcontextprotocol.io) server for AI assistant integration (Claude Desktop, Cursor, VS Code, etc.).

### Tools

| Tool | Description |
|------|-------------|
| `parse_yang` | Parse YANG content into a structured schema tree |
| `check_sonic_compliance` | Check SONiC compliance (score, pass/fail checks) |
| `lint_sonic_yang` | Lint against SONiC YANG guidelines (issues + suggestions) |

### Configuration

Add to your MCP client config (e.g. Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "yang-explorer": {
      "command": "node",
      "args": ["/absolute/path/to/backend/mcp-server.js"]
    }
  }
}
```

### Run standalone

```bash
node backend/mcp-server.js
```

The server communicates via stdio using JSON-RPC (MCP protocol).

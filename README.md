# YANG Explorer

Interactive YANG schema viewer with a Go backend (using [ygot/goyang](https://github.com/openconfig/ygot)) and React frontend.

Upload a `.yang` file and explore its schema in a Swagger-like UI — with collapsible trees, color-coded node types, type details, and metadata.

## Project Structure

```
├── backend/
│   ├── main.go              # HTTP server entry point
│   ├── handlers/             # API handlers (parse, compliance, lint)
│   ├── parser/               # YANG parser, SONiC compliance & linter
│   ├── models/               # Schema, compliance, lint data models
│   ├── testdata/             # Sample YANG files
│   ├── dev-server.js         # Node.js dev fallback server
│   ├── mcp-server.js         # MCP server (stdio transport)
│   └── main_test.go          # Test-based server runner
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Main app with upload + viewer
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
Upload a YANG file (multipart form, field: `yangFile`) and receive the parsed schema as JSON.

### `POST /api/yang/sonic-compliance`
Upload a YANG file and check SONiC compliance. Returns score, pass/fail checks by category.

### `POST /api/yang/sonic-lint`
Upload a YANG file and lint it against [SONiC YANG Model Guidelines](https://github.com/sonic-net/SONiC/blob/master/doc/mgmt/SONiC_YANG_Model_Guidelines.md). Returns issues with severity, guideline numbers, and suggestions.

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

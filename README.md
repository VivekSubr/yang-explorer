# YANG Explorer

Interactive YANG schema viewer with a Go backend (using [ygot/goyang](https://github.com/openconfig/ygot)) and React frontend.

Upload a `.yang` file and explore its schema in a Swagger-like UI — with collapsible trees, color-coded node types, type details, and metadata.

## Project Structure

```
├── backend/
│   ├── main.go              # HTTP server entry point
│   ├── handlers/             # API handlers (upload, parse, CORS)
│   ├── parser/               # YANG parser using goyang
│   ├── models/               # Schema data models
│   ├── testdata/             # Sample YANG files
│   ├── dev-server.js         # Node.js dev fallback server
│   └── main_test.go          # Test-based server runner
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Main app with upload + viewer
│   │   ├── components/
│   │   │   ├── FileUpload.tsx    # Drag-and-drop file upload
│   │   │   ├── SchemaViewer.tsx  # Module header + tree root
│   │   │   └── SchemaNode.tsx    # Recursive schema node renderer
│   │   └── types/
│   │       └── schema.ts        # TypeScript type definitions
│   └── vite.config.ts        # Vite config with API proxy
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

### `GET /api/health`
Returns `{"status":"ok"}`.

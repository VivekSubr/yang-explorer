#!/usr/bin/env node
// MCP Server for YANG Explorer
// Exposes parse, compliance, and lint tools via Model Context Protocol (stdio transport)

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const { parseYang, checkSonicCompliance, lintSonicYang } = require('./dev-server.js');

const server = new McpServer({
  name: 'yang-explorer',
  version: '1.0.0',
  description: 'YANG schema explorer with SONiC compliance and linting tools',
});

// Tool 1: Parse YANG
server.tool(
  'parse_yang',
  'Parse a YANG model file and return its structured schema tree including modules, containers, lists, leaves, types, and metadata',
  {
    yang_content: z.string().describe('The full YANG file content as a string'),
    filename: z.string().optional().describe('Optional filename (e.g. "sonic-acl.yang"). Defaults to "input.yang"'),
  },
  async ({ yang_content, filename }) => {
    try {
      const schema = parseYang(yang_content, filename || 'input.yang');
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(schema, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error parsing YANG: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// Tool 2: SONiC Compliance Check
server.tool(
  'check_sonic_compliance',
  'Check if a YANG model is SONiC compliant. Returns a compliance score (0-100%), pass/fail/warning checks across naming, metadata, structure, and SONiC extension categories',
  {
    yang_content: z.string().describe('The full YANG file content as a string'),
    filename: z.string().optional().describe('Optional filename. Defaults to "input.yang"'),
  },
  async ({ yang_content, filename }) => {
    try {
      const schema = parseYang(yang_content, filename || 'input.yang');
      const result = checkSonicCompliance(schema);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error checking compliance: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// Tool 3: SONiC YANG Linter
server.tool(
  'lint_sonic_yang',
  'Lint a YANG model against the official SONiC YANG Model Guidelines (https://github.com/sonic-net/SONiC/blob/master/doc/mgmt/SONiC_YANG_Model_Guidelines.md). Returns issues with severity (error/warning/info), guideline numbers, and fix suggestions',
  {
    yang_content: z.string().describe('The full YANG file content as a string'),
    filename: z.string().optional().describe('Optional filename. Defaults to "input.yang"'),
  },
  async ({ yang_content, filename }) => {
    try {
      const schema = parseYang(yang_content, filename || 'input.yang');
      const result = lintSonicYang(schema, yang_content);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error linting YANG: ${err.message}` }],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now running on stdio - MCP clients can send JSON-RPC messages
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});

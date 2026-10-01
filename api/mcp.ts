import type { VercelRequest, VercelResponse } from '@vercel/node';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createScheduleServer } from './_lib/mcp-server.js';
import { clientKind, clientProduct, recordToolCall } from './_lib/plugin-usage.js';

/**
 * The ChatGPT plugin endpoint (crackedicehockey.com/mcp). Stateless streamable HTTP: every
 * POST gets a fresh server and transport, so serverless instances share nothing. Read-only
 * public NHL schedule tools; no sign-in.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    // Stateless servers have no session stream to resume (GET) or end (DELETE).
    res.setHeader('Allow', 'POST');
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed. POST MCP requests to this endpoint.' }, id: null });
    return;
  }
  const kind = clientKind(req.headers['user-agent']);
  const product = clientProduct(req.headers['user-agent']);
  const server = createScheduleServer({ onToolCall: (tool, ok) => recordToolCall(tool, kind, ok, product) });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[mcp] request failed:', error);
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
  }
}

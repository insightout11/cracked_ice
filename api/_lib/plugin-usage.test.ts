import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { clientKind, clientProduct, summarizeDay, usageField } from './plugin-usage.js';
import { createScheduleServer } from './mcp-server.js';

describe('plugin usage counts', () => {
  it('splits ChatGPT from other clients by user agent', () => {
    expect(clientKind('openai-mcp/1.0.0')).toBe('chatgpt');
    expect(clientKind('ChatGPT-User/1.0')).toBe('chatgpt');
    expect(clientKind('node')).toBe('other');
    expect(clientKind(undefined)).toBe('other');
    expect(clientProduct('openai-mcp/1.0.0 (linux; x64)')).toBe('openai-mcp');
    expect(clientProduct('Mozilla/5.0 (Windows NT 10.0)')).toBe('mozilla');
    expect(clientProduct('')).toBe('none');
  });

  it('rolls a day up by tool, keeping errors apart', () => {
    const day = summarizeDay('2026-10-05', {
      [usageField('find_streaming_teams', 'chatgpt', true)]: '7',
      [usageField('find_streaming_teams', 'other', true)]: '2',
      [usageField('get_team_schedule', 'chatgpt', false)]: '1',
      'client|openai-mcp': '8',
      'client|node': '2',
    });
    expect(day.clients).toEqual({ 'openai-mcp': 8, node: 2 });
    expect(day.total).toBe(10);
    expect(day.byTool.find_streaming_teams).toEqual({ chatgpt: 7, other: 2, errors: 0 });
    expect(day.byTool.get_team_schedule).toEqual({ chatgpt: 0, other: 0, errors: 1 });
  });

  it('counts every tool call by name and outcome, and nothing about the question', async () => {
    const calls: Array<[string, boolean]> = [];
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await createScheduleServer({ onToolCall: (tool, ok) => { calls.push([tool, ok]); } }).connect(serverTransport);
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(clientTransport);
    await client.callTool({ name: 'get_team_schedule', arguments: { team: 'Canucks', start_date: '2026-10-05' } });
    await client.callTool({ name: 'get_team_schedule', arguments: { team: 'Quebec Nordiques' } });
    expect(calls).toEqual([['get_team_schedule', true], ['get_team_schedule', false]]);
  });
});

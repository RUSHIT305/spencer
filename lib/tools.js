'use strict';

const { WorkspaceError } = require('./workspace.js');

const TOOL_SCHEMAS = [
  { type: 'function', function: { name: 'list_files', description: 'List visible repository files under a relative directory.', parameters: { type: 'object', properties: { path: { type: 'string' }, depth: { type: 'integer', minimum: 0, maximum: 6 } }, required: [] } } },
  { type: 'function', function: { name: 'search_files', description: 'Search UTF-8 text files for a case-insensitive string.', parameters: { type: 'object', properties: { query: { type: 'string' }, path: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'read_file', description: 'Read a UTF-8 text file with line numbers.', parameters: { type: 'object', properties: { path: { type: 'string' }, start_line: { type: 'integer', minimum: 1 }, end_line: { type: 'integer', minimum: 1 } }, required: ['path'] } } },
  { type: 'function', function: { name: 'write_file', description: 'Create or replace a UTF-8 text file inside the workspace.', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'git_status', description: 'Show the current Git branch and short working-tree status.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'run_command', description: 'Run a focused shell command from the workspace root.', parameters: { type: 'object', properties: { command: { type: 'string' }, timeout: { type: 'integer', minimum: 1, maximum: 300 } }, required: ['command'] } } },
];

class ToolRegistry {
  constructor(workspace) { this.workspace = workspace; }

  execute(name, args = {}) {
    const handlers = {
      list_files: () => this.workspace.listFiles(args.path ?? '.', args.depth ?? 2),
      search_files: () => this.workspace.searchFiles(args.query, args.path ?? '.'),
      read_file: () => this.workspace.readFile(args.path, args.start_line ?? 1, args.end_line ?? null),
      write_file: () => this.workspace.writeFile(args.path, args.content),
      git_status: () => this.workspace.gitStatus(),
      run_command: () => this.workspace.runCommand(args.command, args.timeout ? args.timeout * 1000 : undefined),
    };
    if (!handlers[name]) throw new WorkspaceError(`Unknown tool: ${name}`);
    try { return handlers[name](); } catch (error) { throw new WorkspaceError(`Invalid arguments for ${name}: ${error.message}`, { cause: error }); }
  }
}

module.exports = { TOOL_SCHEMAS, ToolRegistry };

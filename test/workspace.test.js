const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { Workspace, WorkspaceError } = require('../lib/workspace.js');

function workspace() {
  return new Workspace(fs.mkdtempSync(path.join(os.tmpdir(), 'spencer-workspace-')));
}


test('workspace writes and reads files within its root', () => {
  const root = workspace();
  assert.match(root.writeFile('src/example.js', 'const value = 1;\n'), /Wrote 2 lines/);
  assert.match(root.readFile('src/example.js'), /1: const value = 1;/);
});


test('workspace rejects traversal and absolute paths', () => {
  const root = workspace();
  assert.throws(() => root.readFile('../outside.txt'), WorkspaceError);
  assert.throws(() => root.readFile(path.resolve('/tmp/outside.txt')), WorkspaceError);
});


test('workspace runs focused commands and blocks destructive commands', () => {
  const root = workspace();
  const command = process.platform === 'win32' ? 'echo %SPENCER_WORKSPACE%' : 'printf "$SPENCER_WORKSPACE"';
  assert.match(root.runCommand(command), /exit_code=0/);
  assert.throws(() => root.runCommand('git reset --hard'), /blocked/);
});

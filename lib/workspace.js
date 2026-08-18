'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

class WorkspaceError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'WorkspaceError';
  }
}

class Workspace {
  constructor(root, options = {}) {
    this.root = fs.realpathSync(path.resolve(root));
    this.maxOutputChars = options.maxOutputChars ?? 12_000;
    this.maxFileChars = options.maxFileChars ?? 500_000;
    this.commandTimeoutMs = options.commandTimeoutMs ?? 30_000;
    if (!fs.statSync(this.root).isDirectory()) throw new WorkspaceError(`Workspace is not a directory: ${this.root}`);
  }

  safePath(relativePath) {
    if (path.isAbsolute(relativePath)) throw new WorkspaceError('Absolute paths are not allowed');
    const candidate = path.resolve(this.root, relativePath);
    const relative = path.relative(this.root, candidate);
    if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) throw new WorkspaceError('Path escapes the workspace');
    if (fs.existsSync(candidate)) {
      const real = fs.realpathSync(candidate);
      const realRelative = path.relative(this.root, real);
      if (realRelative.startsWith(`..${path.sep}`) || realRelative === '..') throw new WorkspaceError('Path escapes the workspace through a symlink');
    }
    return candidate;
  }

  listFiles(relativePath = '.', depth = 2) {
    const base = this.safePath(relativePath);
    if (!fs.existsSync(base)) throw new WorkspaceError(`Path does not exist: ${relativePath}`);
    if (fs.statSync(base).isFile()) return path.relative(this.root, base).split(path.sep).join('/');
    const ignored = new Set(['.git', 'node_modules', '.cache']);
    const result = [];
    const walk = (current, level) => {
      if (level > depth || result.length >= 200) return;
      for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name.startsWith('.') || ignored.has(entry.name)) continue;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full, level + 1);
        else result.push(path.relative(this.root, full).split(path.sep).join('/'));
        if (result.length >= 200) break;
      }
    };
    walk(base, 0);
    if (result.length >= 200) result.push('... (truncated at 200 files)');
    return result.join('\n') || '(no visible files)';
  }

  searchFiles(query, relativePath = '.') {
    if (!query) throw new WorkspaceError('Search query cannot be empty');
    const base = this.safePath(relativePath);
    const matches = [];
    const ignored = new Set(['.git', 'node_modules', '.cache']);
    const walk = (current) => {
      if (matches.length >= 100) return;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || ignored.has(entry.name)) continue;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else {
          let stat;
          try { stat = fs.statSync(full); } catch { continue; }
          if (stat.size > this.maxFileChars) continue;
          let text;
          try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
          text.split(/\r?\n/).forEach((line, index) => {
            if (matches.length < 100 && line.toLowerCase().includes(query.toLowerCase())) {
              matches.push(`${path.relative(this.root, full).split(path.sep).join('/')}:${index + 1}: ${line.slice(0, 240)}`);
            }
          });
        }
      }
    };
    walk(base);
    return matches.join('\n') || '(no matches)';
  }

  readFile(relativePath, startLine = 1, endLine = null) {
    const file = this.safePath(relativePath);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new WorkspaceError(`Not a file: ${relativePath}`);
    if (fs.statSync(file).size > this.maxFileChars) throw new WorkspaceError(`File is larger than the configured limit: ${relativePath}`);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    const selected = lines.slice(startLine - 1, endLine ?? lines.length);
    return this.truncate(selected.map((line, index) => `${index + startLine}: ${line}`).join('\n'));
  }

  writeFile(relativePath, content) {
    if (content.length > this.maxFileChars) throw new WorkspaceError(`Content is larger than the configured limit: ${relativePath}`);
    const file = this.safePath(relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const mode = fs.existsSync(file) ? fs.statSync(file).mode : null;
    const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
    try {
      fs.writeFileSync(temporary, content, { encoding: 'utf8', mode: mode ?? 0o644 });
      if (mode) fs.chmodSync(temporary, mode);
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    return `Wrote ${content.split(/\r?\n/).length} lines to ${path.relative(this.root, file).split(path.sep).join('/')}.`;
  }

  gitStatus() {
    const result = spawnSync('git', ['status', '--short', '--branch'], { cwd: this.root, encoding: 'utf8', timeout: this.commandTimeoutMs });
    if (result.error || result.status !== 0) return 'Not a Git repository or Git status unavailable.';
    return this.truncate((result.stdout || '').trim() || 'Working tree clean.');
  }

  runCommand(command, timeoutMs = this.commandTimeoutMs) {
    const blocked = Workspace.blockedCommandReason(command);
    if (blocked) throw new WorkspaceError(`Command blocked by Spencer safety policy: ${blocked}`);
    const shell = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : (process.env.SHELL || '/bin/sh');
    const result = spawnSync(command, { cwd: this.root, shell: true, executable: shell, encoding: 'utf8', timeout: timeoutMs, env: { ...process.env, SPENCER_WORKSPACE: this.root } });
    if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') return this.truncate(`Command timed out after ${timeoutMs}ms.\n${result.stdout || ''}${result.stderr || ''}`);
    return this.truncate(`exit_code=${result.status ?? 1}\n${result.stdout || ''}${result.stderr || ''}`.trim());
  }

  snapshot() {
    return { workspace: this.root, files: this.listFiles('.', 2), git_status: this.gitStatus() };
  }

  truncate(text) {
    return text.length <= this.maxOutputChars ? text : `${text.slice(0, this.maxOutputChars)}\n... (output truncated)`;
  }

  static blockedCommandReason(command) {
    const normalized = command.trim().toLowerCase().replace(/\s+/g, ' ');
    const checks = [
      [/^(?:.*[;&|])\s*sudo\b/, 'sudo is not allowed inside the agent loop'],
      [/rm\s+-[^\n]*r[^\n]*f\s+\/(?:\s|$)/, 'recursive deletion from filesystem root is not allowed'],
      [/git\s+reset\s+--hard/, 'destructive Git resets require manual execution'],
      [/git\s+clean\s+-[^\n]*f/, 'destructive Git clean requires manual execution'],
      [/:\(\)\s*\{/, 'fork-bomb patterns are not allowed'],
      [/\b(shutdown|reboot|poweroff)\b/, 'system power commands are not allowed'],
    ];
    return checks.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
  }
}

module.exports = { Workspace, WorkspaceError };

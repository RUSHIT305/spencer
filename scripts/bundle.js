'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'bin', 'spencer.js');
const output = path.resolve(process.argv[2] || path.join(root, 'dist', 'spencer-entry.js'));
const modulePattern = /require\(\s*(['"])(\.\.?[\\/][^'"]+)\1\s*\)/g;
const modules = new Map();

function resolveModule(fromFile, request) {
  const candidate = path.resolve(path.dirname(fromFile), request);
  const files = [candidate, `${candidate}.js`, path.join(candidate, 'index.js')];
  const resolved = files.find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
  if (!resolved) throw new Error(`Cannot resolve local module ${request} from ${fromFile}`);
  return path.normalize(resolved);
}

function moduleId(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function collect(file) {
  const normalized = path.normalize(file);
  if (modules.has(normalized)) return;
  const source = fs.readFileSync(normalized, 'utf8').replace(/^#![^\n]*\n/, '');
  modules.set(normalized, source);
  for (const match of source.matchAll(modulePattern)) collect(resolveModule(normalized, match[2]));
}

collect(entry);
const lines = [
  "'use strict';",
  'const __spencerModules = Object.create(null);',
  'const __spencerCache = Object.create(null);',
  'function __spencerRequire(request, parentId) {',
  "  if (!request.startsWith('.')) return require(request);",
  '  const parent = parentId || __spencerEntryId;',
  '  const parentDir = parent.slice(0, parent.lastIndexOf(\'/\'));',
  '  const candidate = parentDir ? `${parentDir}/${request}` : request;',
  '  const normalized = candidate.split(\'/\').reduce((parts, part) => {',
  "    if (!part || part === '.') return parts;",
  "    if (part === '..') parts.pop(); else parts.push(part);",
  '    return parts;',
  '  }, []).join(\'/\');',
  '  const id = normalized.endsWith(\'.js\') ? normalized : `${normalized}.js`;',
  '  if (!__spencerModules[id]) throw new Error(`Bundled module not found: ${id}`);',
  '  if (__spencerCache[id]) return __spencerCache[id].exports;',
  '  const module = { exports: {} };',
  '  __spencerCache[id] = module;',
  '  __spencerModules[id](module, module.exports, (child) => __spencerRequire(child, id));',
  '  return module.exports;',
  '}',
];

for (const [file, source] of modules) {
  const id = moduleId(file);
  const transformed = source.replace(modulePattern, (_match, _quote, request) => `__spencerRequire(${JSON.stringify(request)}, __spencerCurrentModuleId)`);
  lines.push(`__spencerModules[${JSON.stringify(id)}] = function(module, exports, require) {`);
  lines.push(`  const __spencerCurrentModuleId = ${JSON.stringify(id)};`);
  lines.push(transformed);
  lines.push('};');
}

const entryId = moduleId(entry);
lines.push(`const __spencerEntryId = ${JSON.stringify(entryId)};`);
lines.push('const __spencerEntryModule = { exports: {} };');
lines.push('__spencerCache[__spencerEntryId] = __spencerEntryModule;');
lines.push('__spencerModules[__spencerEntryId](__spencerEntryModule, __spencerEntryModule.exports, (child) => __spencerRequire(child, __spencerEntryId));');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${lines.join('\n')}\n`);
console.log(`Bundled ${modules.size} local modules into ${output}`);

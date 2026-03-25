#!/usr/bin/env node
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { init, parse } from 'es-module-lexer';

const cjsRequire = createRequire(import.meta.url);
const ROOT_PATH = path.resolve(import.meta.dirname, '..', '..', '..');
const JS_ROOT = path.join(ROOT_PATH, 'app/assets/javascripts');
const EXTENSIONS = ['.mjs', '.js'];
const OUTPUT_PATH = path.join(ROOT_PATH, 'tmp', 'infection_scanner.json');
const CONCURRENCY = 64;

// --- Alias resolution (loaded from webpack config) ---

function buildAliasMap() {
  const webpackConfig = cjsRequire(path.join(ROOT_PATH, 'config/webpack.config.js'));
  const { CONTEXT_ALIASES } = cjsRequire(
    path.join(ROOT_PATH, 'config/helpers/context_aliases_shared'),
  );
  const aliases = { ...webpackConfig.resolve.alias };
  // Context aliases represent "vue3 mode" resolution — the infection plugin
  // applies these at runtime.  Merge them as exact-match aliases ($ suffix)
  // so the scanner follows the same resolution paths.
  for (const [key, target] of Object.entries(CONTEXT_ALIASES)) {
    aliases[`${key}$`] = target;
  }
  return aliases;
}

const aliasMap = buildAliasMap();
const sortedAliasKeys = Object.keys(aliasMap).sort((a, b) => {
  const aExact = a.endsWith('$');
  const bExact = b.endsWith('$');
  if (aExact !== bExact) return aExact ? -1 : 1;
  return b.length - a.length;
});

function applyAlias(specifier) {
  for (const key of sortedAliasKeys) {
    const isExact = key.endsWith('$');
    const aliasName = isExact ? key.slice(0, -1) : key;
    const target = aliasMap[key];

    if (isExact && specifier === aliasName) {
      return target;
    }
    if (!isExact && (specifier === aliasName || specifier.startsWith(`${aliasName}/`))) {
      return `${target}${specifier.slice(aliasName.length)}`;
    }
  }
  return specifier;
}

// --- File helpers ---

const fileExistsCache = new Map();

function tryFile(p) {
  if (fileExistsCache.has(p)) return fileExistsCache.get(p);
  const exists = fs.existsSync(p) && fs.statSync(p).isFile();
  fileExistsCache.set(p, exists);
  return exists;
}

function resolveFile(absPath) {
  if (tryFile(absPath)) return absPath;

  for (const ext of EXTENSIONS) {
    if (tryFile(absPath + ext)) return absPath + ext;
  }

  if (absPath.endsWith('.vue') || absPath.endsWith('.mjs') || absPath.endsWith('.js')) {
    return null;
  }

  const indexCandidates = [
    path.join(absPath, 'index.mjs'),
    path.join(absPath, 'index.js'),
    path.join(absPath, 'index.vue'),
  ];
  for (const candidate of indexCandidates) {
    if (tryFile(candidate)) return candidate;
  }

  return null;
}

// --- Module resolution ---

function findPkgDir(pkgName, fromDir = ROOT_PATH) {
  let dir = fromDir;
  while (true) {
    const candidate = path.join(dir, 'node_modules', pkgName, 'package.json');
    if (fs.existsSync(candidate)) return path.dirname(candidate);
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Resolve a path from pkg.exports, mimicking Vite/Node ESM resolution.
 * Handles string, object with `import`/`module`/`default` conditions, and
 * nested condition objects. Returns the first matching path or null.
 */
function resolveExportsEntry(exportsValue, pkgDir) {
  if (typeof exportsValue === 'string') {
    const p = path.resolve(pkgDir, exportsValue);
    return tryFile(p) ? p : null;
  }
  if (exportsValue && typeof exportsValue === 'object' && !Array.isArray(exportsValue)) {
    // Resolve conditions in package.json key order (matching Node/bundler behaviour)
    // against the set of conditions bundlers support.
    const supported = new Set(['module', 'import', 'default']);
    for (const key of Object.keys(exportsValue)) {
      if (supported.has(key)) {
        const result = resolveExportsEntry(exportsValue[key], pkgDir);
        if (result) return result;
      }
    }
  }
  return null;
}

function resolveNodeModuleAll(specifier, fromDir = ROOT_PATH) {
  const results = new Set();
  const parts = specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2)
    : specifier.split('/').slice(0, 1);
  const pkgName = parts.join('/');
  const subpath = specifier.slice(pkgName.length) || '.';

  const pkgDir = findPkgDir(pkgName, fromDir);
  if (pkgDir) {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf-8'));

    // 1. Try pkg.exports (Vite/Node ESM resolution)
    if (pkg.exports) {
      let exportsEntry;
      if (typeof pkg.exports === 'string' || !pkg.exports['.']) {
        exportsEntry =
          subpath === '.'
            ? pkg.exports
            : pkg.exports[subpath] || pkg.exports[`${subpath}/index`];
      } else {
        exportsEntry = pkg.exports[subpath];
      }

      if (exportsEntry) {
        const resolved = resolveExportsEntry(exportsEntry, pkgDir);
        if (resolved) results.add(resolved);
      }
    }

    // 2. Also try pkg.module and pkg.main (webpack 4 ignores exports and uses these)
    if (subpath === '.' || subpath === '/') {
      if (pkg.module) {
        const esmPath = path.resolve(pkgDir, pkg.module);
        if (tryFile(esmPath)) results.add(esmPath);
      }
      if (pkg.main) {
        const mainPath = path.resolve(pkgDir, pkg.main);
        if (tryFile(mainPath)) results.add(mainPath);
      }
    } else {
      const subDir = path.resolve(pkgDir, subpath.startsWith('.') ? subpath : subpath.slice(1));
      const subPkgJson = path.join(subDir, 'package.json');
      if (fs.existsSync(subPkgJson)) {
        const subPkg = JSON.parse(fs.readFileSync(subPkgJson, 'utf-8'));
        if (subPkg.module) {
          const esmPath = path.resolve(subDir, subPkg.module);
          if (tryFile(esmPath)) results.add(esmPath);
        }
      }
      const subFile = resolveFile(path.resolve(pkgDir, subpath.startsWith('.') ? subpath : subpath.slice(1)));
      if (subFile) results.add(subFile);
    }

    // 3. Apply browser field (webpack resolves browser-specific alternatives)
    //    String form: alternative entry point for browser builds
    if (typeof pkg.browser === 'string' && (subpath === '.' || subpath === '/')) {
      const browserPath = path.resolve(pkgDir, pkg.browser);
      if (tryFile(browserPath)) results.add(browserPath);
    }
    //    Object form: file-level remapping
    if (pkg.browser && typeof pkg.browser === 'object') {
      const remapped = new Set();
      for (const resolved of results) {
        const relPath = `./${path.relative(pkgDir, resolved).replace(/\\/g, '/')}`;
        if (pkg.browser[relPath]) {
          const browserPath = path.resolve(pkgDir, pkg.browser[relPath]);
          if (tryFile(browserPath)) remapped.add(browserPath);
        }
      }
      for (const p of remapped) results.add(p);
    }
  }

  if (results.size > 0) return [...results];

  try {
    const resolved = cjsRequire.resolve(specifier, { paths: [fromDir] });
    return resolved ? [resolved] : null;
  } catch {
    return null;
  }
}

const resolveCache = new Map();

function resolveModuleAll(specifier, fromFile) {
  const cacheKey = `${fromFile}\0${specifier}`;
  if (resolveCache.has(cacheKey)) return resolveCache.get(cacheKey);

  const aliased = applyAlias(specifier.replace(/\?vue3$/, ''));

  let results;
  if (path.isAbsolute(aliased)) {
    const r = resolveFile(aliased);
    results = r ? [r] : null;
  } else if (aliased.startsWith('.')) {
    const dir = path.dirname(fromFile);
    const r = resolveFile(path.resolve(dir, aliased));
    results = r ? [r] : null;
  } else {
    results = resolveNodeModuleAll(aliased, path.dirname(fromFile));
  }

  resolveCache.set(cacheKey, results);
  return results;
}

function resolveModule(specifier, fromFile) {
  const all = resolveModuleAll(specifier, fromFile);
  return all ? all[0] : null;
}

// --- Entry discovery ---

function discoverEntries() {
  const { generateEntries } = cjsRequire(path.join(ROOT_PATH, 'config/webpack.helpers'));
  const defaultEntries = ['./main'];
  const generated = generateEntries({ defaultEntries });

  const manual = {
    sentry: ['./sentry/index.js'],
    coverage_persistence: ['./entrypoints/coverage_persistence.js'],
    performance_bar: ['./entrypoints/performance_bar.js'],
    jira_connect_app: ['./jira_connect/subscriptions/index.js'],
    sandboxed_mermaid: ['./lib/mermaid.js'],
    redirect_listbox: ['./entrypoints/behaviors/redirect_listbox.js'],
    sandboxed_swagger: ['./lib/swagger.js'],
    super_sidebar: ['./entrypoints/super_sidebar.js'],
    tracker: ['./entrypoints/tracker.js'],
    analytics: ['./entrypoints/analytics.js'],
    graphql_explorer: ['./entrypoints/graphql_explorer.js'],
  };

  const all = { default: defaultEntries, ...manual, ...generated };

  const dummyFromFile = path.join(JS_ROOT, '__entry__.js');
  const entrypoints = {};
  for (const [name, files] of Object.entries(all)) {
    const last = Array.isArray(files) ? files[files.length - 1] : files;
    const resolved = resolveModule(last, dummyFromFile);
    if (resolved) {
      entrypoints[name] = resolved;
    }
  }
  return entrypoints;
}

// --- Vue SFC script extraction ---

function extractScriptContent(source) {
  const scriptMatch = source.match(/<script(?:\s[^>]*)?>([^]*?)<\/script>/i);
  if (!scriptMatch) return '';
  return scriptMatch[1];
}

// --- App root detection ---

/**
 * Detect whether code is a Vue "app root": a file that imports Vue as a
 * default import and instantiates it with `new Vue(...)`.
 *
 * Disqualified when:
 *  - any named imports from 'vue' exist  (`import { computed } from 'vue'`)
 *  - the default import is used with property access other than `.use()`
 */
function detectAppRoot(code) {
  // Strip single-line and multi-line comments to avoid false positives
  const stripped = code
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Reject if there are any named (non-default) imports from 'vue'
  //   import { computed } from 'vue'
  //   import Vue, { computed } from 'vue'
  if (/import\s+\{[^}]*\}\s+from\s+['"]vue['"]/.test(stripped)) return false;

  // Match a default import from 'vue':  import Foo from 'vue'
  const defaultImport = stripped.match(
    /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]vue['"]/,
  );
  if (!defaultImport) return false;

  const name = defaultImport[1];
  // Escape for use in RegExp (name is an identifier so safe, but be cautious)
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Must contain `new <Name>(`
  if (!new RegExp(`new\\s+${esc}\\s*\\(`).test(stripped)) return false;

  // Reject if the identifier is used with property access other than .use()
  // Remove all `<Name>.use(` occurrences first, then check for remaining property access
  const withoutUse = stripped.replace(new RegExp(`${esc}\\s*\\.\\s*use\\s*\\(`, 'g'), '');
  if (new RegExp(`${esc}\\s*\\.\\s*[A-Za-z_$]`).test(withoutUse)) return false;

  return true;
}

// --- File parsing ---

async function parseFile(filePath) {
  let source;
  try {
    source = await readFile(filePath, 'utf-8');
  } catch {
    return { imports: [], appRoot: false };
  }

  const isVue = filePath.endsWith('.vue');
  const code = isVue ? extractScriptContent(source) : source;
  if (!code) return { imports: [], appRoot: false };

  let imports = [];
  try {
    const [parsed] = parse(code);
    imports = parsed
      .filter((imp) => imp.n)
      .map((imp) => ({
        source: imp.n,
        dynamic: imp.d >= 0,
      }));
  } catch {
    // parse failed – imports stays empty
  }

  const appRoot = detectAppRoot(code);

  return { imports, appRoot };
}

// --- Graph building ---

function isJsOrVue(resolved) {
  if (!resolved) return false;
  return resolved.endsWith('.js') || resolved.endsWith('.mjs') || resolved.endsWith('.vue');
}

async function buildGraph(entrypoints) {
  await init;

  const graph = {};
  const appRootSet = new Set();
  const visited = new Set();
  const queue = [];

  for (const absPath of Object.values(entrypoints)) {
    if (!visited.has(absPath) && tryFile(absPath)) {
      visited.add(absPath);
      queue.push(absPath);
    }
  }

  let idx = 0;
  const total = () => queue.length;

  while (idx < queue.length) {
    const batch = queue.slice(idx, idx + CONCURRENCY);
    idx += batch.length;

    // eslint-disable-next-line no-await-in-loop
    const results = await Promise.all(
      batch.map(async (filePath) => {
        const { imports, appRoot } = await parseFile(filePath);
        const resolved = imports.map((imp) => {
          const all = resolveModuleAll(imp.source, filePath);
          const r = all ? all[0] : null;
          return { source: imp.source, resolved: r, dynamic: imp.dynamic, alternatives: all };
        });
        return { filePath, resolved, appRoot };
      }),
    );

    for (const { filePath, resolved, appRoot } of results) {
      graph[filePath] = resolved.filter((imp) => !imp.resolved || isJsOrVue(imp.resolved));
      if (appRoot) appRootSet.add(filePath);
      for (const imp of resolved) {
        // Queue the primary resolution and all alternatives (e.g. pkg.exports
        // vs pkg.module) so both Vite and webpack paths appear in the graph.
        const paths = imp.alternatives || (imp.resolved ? [imp.resolved] : []);
        for (const p of paths) {
          if (isJsOrVue(p) && !visited.has(p)) {
            visited.add(p);
            queue.push(p);
          }
        }
      }
    }

    if (idx % 500 < CONCURRENCY) {
      process.stderr.write(`\rParsed ${idx}/${total()} files...`);
    }
  }

  process.stderr.write(`\rParsed ${total()}/${total()} files. Done.\n`);
  console.log(`App roots: ${appRootSet.size} files`);
  return { graph, appRootSet };
}

// --- Infection computation ---

const INFECTION_SPECIFIERS = (() => {
  const { CONTEXT_ALIASES } = cjsRequire(
    path.join(ROOT_PATH, 'config/helpers/context_aliases_shared'),
  );
  return Object.keys(CONTEXT_ALIASES);
})();

function getInfectionSourceReason(imports) {
  for (const imp of imports) {
    if (INFECTION_SPECIFIERS.some((s) => imp.source === s || imp.source.startsWith(`${s}/`))) {
      return imp.source;
    }
  }
  return null;
}

function computeInfected(graph, appRootSet) {
  const infectedSet = new Set();
  const infectionTriggers = new Map();

  for (const [file, imports] of Object.entries(graph)) {
    const reason = getInfectionSourceReason(imports);
    if (reason) {
      infectedSet.add(file);
      infectionTriggers.set(file, [file]);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [file, imports] of Object.entries(graph)) {
      if (!infectedSet.has(file)) {
        const sources = [];
        for (const imp of imports) {
          // App roots are barriers: they become infected but don't propagate further
          if (imp.resolved && infectedSet.has(imp.resolved) && !appRootSet.has(imp.resolved)) {
            sources.push(imp.resolved);
          }
        }
        if (sources.length) {
          infectedSet.add(file);
          infectionTriggers.set(file, sources);
          changed = true;
        }
      }
    }
  }

  console.log(`Infected: ${infectedSet.size} / ${Object.keys(graph).length} files`);
  return { infectedSet, infectionTriggers };
}

function findNearestInfectionReasons({ file, infectionTriggers, graph, maxShown = 3 }) {
  const reasons = [];
  let totalCount = 0;
  const visited = new Set();
  const queue = [file];
  visited.add(file);

  while (queue.length) {
    const current = queue.shift();
    const sources = infectionTriggers.get(current);
    if (sources) {
      for (const src of sources) {
        if (src === current) {
          const reason = getInfectionSourceReason(graph[current] || []);
          if (reason) {
            totalCount += 1;
            if (reasons.length < maxShown) {
              reasons.push({ file: current, reason });
            }
          }
        } else if (!visited.has(src)) {
          visited.add(src);
          queue.push(src);
        }
      }
    }
  }

  return { reasons, totalCount };
}

// --- JSON output ---

function writeOutput(entrypoints, graph, appRootSet) {
  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const { infectedSet, infectionTriggers } = computeInfected(graph, appRootSet);

  const annotatedGraph = {};
  for (const [file, imports] of Object.entries(graph)) {
    const entry = {
      imports,
      infected: infectedSet.has(file),
      appRoot: appRootSet.has(file),
    };
    if (entry.infected) {
      const { reasons, totalCount } = findNearestInfectionReasons({
        file,
        infectionTriggers,
        graph,
        maxShown: 3,
      });
      entry.infectionReasons = reasons.map((s) => ({ file: s.file, reason: s.reason }));
      entry.infectionReasonCount = totalCount;
    }
    annotatedGraph[file] = entry;
  }

  const output = { entrypoints, graph: annotatedGraph };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Written to ${OUTPUT_PATH}`);
  return output;
}

// --- Main ---

async function runAnalysis() {
  console.log('Discovering entrypoints...');
  const entrypoints = discoverEntries();
  console.log(`Found ${Object.keys(entrypoints).length} entrypoints`);
  console.log('Building import graph...');
  const { graph, appRootSet } = await buildGraph(entrypoints);
  return writeOutput(entrypoints, graph, appRootSet);
}

await runAnalysis();

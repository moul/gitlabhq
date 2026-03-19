import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { CONTEXT_ALIASES } = require('./context_aliases_shared');

const VUE3_QUERY = 'vue3';
const VUE3_SUFFIX = '.vue3-infected';
const VUE3_SUFFIX_RE = /\.vue3-infected(\.\w+)/;
const INFECTABLE_RE = /\.(js|mjs|vue)$/;
const INFECTION_BLOCKLIST = ['app/assets/javascripts/lib/graphql.js'];

const toURL = (id) => new URL(id, 'https://dummy.base');

const parseId = (id) => {
  if (!id) return { path: '', params: new URLSearchParams() };
  const url = toURL(id);
  return { path: url.pathname, params: url.searchParams };
};

const isInfectedByQuery = (id) => parseId(id).params.has(VUE3_QUERY);
const isInfectedBySuffix = (id) => VUE3_SUFFIX_RE.test(id);
const isInfected = (id) => isInfectedByQuery(id) || isInfectedBySuffix(id);
const isBlocked = (id) => INFECTION_BLOCKLIST.some((blocked) => parseId(id).path.endsWith(blocked));
const isInfectable = (id) => INFECTABLE_RE.test(parseId(id).path) && !isBlocked(id);
const SPECIAL_QUERIES = ['vue', 'worker', 'raw', 'url', 'inline', 'sharedworker'];
const hasSpecialQuery = (id) => {
  const { params } = parseId(id);
  return SPECIAL_QUERIES.some((q) => params.has(q));
};
const isVirtualModule = (id) => id.startsWith('\0');

const cleanInfectedId = (id) => id.replace(VUE3_SUFFIX, '');

const appendVue3Query = (resolvedId) => {
  if (isInfected(resolvedId)) return resolvedId;
  const url = toURL(resolvedId);
  url.searchParams.set(VUE3_QUERY, '');
  return url.pathname + url.search;
};

const appendVue3Suffix = (resolvedId) => {
  if (isInfected(resolvedId)) return resolvedId;
  const { path: filePath, params } = parseId(resolvedId);
  const ext = filePath.match(/(\.\w+)$/)?.[1] || '';
  const base = filePath.slice(0, -ext.length);
  const infectedPath = base + VUE3_SUFFIX + ext;
  return params.size > 0 ? `${infectedPath}?${params.toString()}` : infectedPath;
};

export function Vue3InfectionPlugin() {
  const contextAliasKeys = Object.keys(CONTEXT_ALIASES);
  let isBuild = false;

  return {
    name: 'gitlab-vue3-infection',
    enforce: 'pre',

    configResolved(config) {
      isBuild = config.command === 'build';
    },

    buildEnd() {
      const allIds = [...this.getModuleIds()];
      const infected = new Set();
      const clean = new Set();

      for (const id of allIds) {
        const cleanPath = isBuild ? cleanInfectedId(parseId(id).path) : parseId(id).path;
        if (isInfected(id)) {
          infected.add(cleanPath);
        } else {
          clean.add(cleanPath);
        }
      }

      const duplicated = [...infected].filter((p) => clean.has(p));
      console.log(
        `[vue3-infection] total: ${allIds.length}, ` +
          `infected: ${infected.size}, duplicated: ${duplicated.length}`,
      );
    },

    async load(id) {
      if (!isBuild) return null;
      if (isVirtualModule(id) || !isInfectedBySuffix(id) || hasSpecialQuery(id)) return null;
      const { path: filePath } = parseId(id);
      const realPath = cleanInfectedId(filePath);
      return readFile(realPath, 'utf-8');
    },

    async resolveId(source, importer, options) {
      const { path: sourcePath, params: sourceParams } = parseId(source);
      const explicitlyRequestsInfection = sourceParams.has(VUE3_QUERY);

      if (
        isVirtualModule(source) ||
        hasSpecialQuery(source) ||
        (!explicitlyRequestsInfection && !isInfected(importer))
      ) {
        return null;
      }

      const resolve = (id) => this.resolve(id, importer, { ...options, skipSelf: true });
      const sourceToResolve = explicitlyRequestsInfection ? sourcePath : source;
      const appendVue3 = isBuild ? appendVue3Suffix : appendVue3Query;

      const aliasKey = contextAliasKeys.find((k) => sourceToResolve === k);
      if (aliasKey) {
        const importerPath = isBuild
          ? cleanInfectedId(parseId(importer).path)
          : parseId(importer).path;
        const resolved = await resolve(CONTEXT_ALIASES[aliasKey]);
        if (!resolved || parseId(resolved.id).path === importerPath) return null;
        return appendVue3(resolved.id);
      }

      const resolved = await resolve(sourceToResolve);
      if (resolved && isInfectable(resolved.id)) {
        return appendVue3(resolved.id);
      }

      return null;
    },
  };
}

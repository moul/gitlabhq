import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { CONTEXT_ALIASES } = require('./context_aliases_shared');

const VUE3_QUERY = 'vue3';
const INFECTABLE_RE = /\.(js|mjs|vue)$/;
const INFECTION_BLOCKLIST = ['app/assets/javascripts/lib/graphql.js'];

const toURL = (id) => new URL(id, 'https://dummy.base');

const parseId = (id) => {
  if (!id) return { path: '', params: new URLSearchParams() };
  const url = toURL(id);
  return { path: url.pathname, params: url.searchParams };
};

const isInfected = (id) => parseId(id).params.has(VUE3_QUERY);
const isBlocked = (id) => INFECTION_BLOCKLIST.some((blocked) => parseId(id).path.endsWith(blocked));
const isInfectable = (id) => INFECTABLE_RE.test(parseId(id).path) && !isBlocked(id);
const isVueSubRequest = (id) => parseId(id).params.has('vue');
const isVirtualModule = (id) => id.startsWith('\0');

const appendVue3 = (resolvedId) => {
  if (isInfected(resolvedId)) return resolvedId;
  const url = toURL(resolvedId);
  url.searchParams.set(VUE3_QUERY, '');
  return url.pathname + url.search;
};

export function Vue3InfectionPlugin() {
  const contextAliasKeys = Object.keys(CONTEXT_ALIASES);

  return {
    name: 'gitlab-vue3-infection',
    enforce: 'pre',

    async resolveId(source, importer, options) {
      const { path: sourcePath, params: sourceParams } = parseId(source);
      const explicitlyRequestsInfection = sourceParams.has(VUE3_QUERY);

      if (
        isVirtualModule(source) ||
        isVueSubRequest(source) ||
        (!explicitlyRequestsInfection && !isInfected(importer))
      ) {
        return null;
      }

      const resolve = (id) => this.resolve(id, importer, { ...options, skipSelf: true });
      const sourceToResolve = explicitlyRequestsInfection ? sourcePath : source;

      const aliasKey = contextAliasKeys.find((k) => sourceToResolve === k);
      if (aliasKey) {
        const importerPath = parseId(importer).path;
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

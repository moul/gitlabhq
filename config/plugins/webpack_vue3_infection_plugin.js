/* eslint-disable no-param-reassign */
const path = require('path');
const {
  CONTEXT_ALIASES,
  INFECTABLE_RE,
  INFECTION_BLOCKLIST,
} = require('../helpers/context_aliases_shared');

const PLUGIN_NAME = 'WebpackVue3InfectionPlugin';
const VUE3_QUERY = '?vue3';
const contextAliasKeys = Object.keys(CONTEXT_ALIASES);

const stripQuery = (id) => {
  if (!id) return '';
  const idx = id.indexOf('?');
  return idx >= 0 ? id.substr(0, idx) : id;
};

const getQuery = (id) => {
  if (!id) return '';
  const idx = id.indexOf('?');
  return idx >= 0 ? id.substr(idx) : '';
};

const hasVue3Query = (id) => {
  if (!id) return false;
  return getQuery(id).includes('vue3');
};

const SPECIAL_QUERIES = ['vue', 'worker', 'raw', 'url', 'inline', 'sharedworker'];
const hasSpecialQuery = (id) => {
  const query = getQuery(id);
  if (!query) return false;
  const params = new URLSearchParams(query.slice(1));
  return SPECIAL_QUERIES.some((q) => params.has(q));
};

const isBlocked = (id) => {
  const clean = stripQuery(id);
  return INFECTION_BLOCKLIST.some((blocked) => clean.endsWith(blocked));
};

const isInfectable = (id) => {
  const clean = stripQuery(id);
  return INFECTABLE_RE.test(clean) && !isBlocked(id);
};

const appendVue3 = (resource) => {
  if (hasVue3Query(resource)) return resource;
  const query = getQuery(resource);
  const filePath = stripQuery(resource);
  return query ? `${filePath}${query}&vue3` : `${filePath}${VUE3_QUERY}`;
};

const rebuildRequest = (loaders, resource) => {
  return loaders
    .map((l) => {
      if (typeof l === 'string') return l;
      let ident = l.loader;
      if (l.options) {
        if (typeof l.options === 'string') {
          ident += `?${l.options}`;
        } else if (l.ident) {
          ident += `??${l.ident}`;
        } else {
          ident += `?${JSON.stringify(l.options)}`;
        }
      }
      return ident;
    })
    .concat([resource])
    .join('!');
};

const resolveAliasTargets = () => {
  const resolved = {};
  for (const key of contextAliasKeys) {
    const target = CONTEXT_ALIASES[key];
    if (path.isAbsolute(target)) {
      resolved[key] = target;
    } else {
      try {
        resolved[key] = require.resolve(target);
      } catch (e) {
        resolved[key] = target;
      }
    }
  }
  return resolved;
};

const applyInfectionResolving = (nmf, infectedFiles, resolvedTargets) => {
  const pendingInfections = new WeakSet();

  nmf.hooks.beforeResolve.tap(PLUGIN_NAME, (result) => {
    if (!result) return undefined;

    const { request, contextInfo, dependencies } = result;
    const issuer = (contextInfo && contextInfo.issuer) || '';
    const requestExplicitlyInfected = hasVue3Query(request);
    const importerIsInfected = infectedFiles.has(issuer);

    if (!requestExplicitlyInfected && !importerIsInfected) return undefined;
    if (hasSpecialQuery(request)) return undefined;
    if (request.includes('!')) return undefined;

    const cleanRequest = requestExplicitlyInfected ? stripQuery(request) : request;

    const aliasKey = contextAliasKeys.find((k) => cleanRequest === k);
    if (aliasKey) {
      const aliasTarget = resolvedTargets[aliasKey];
      if (aliasTarget === issuer) return undefined;
      result.request = aliasTarget;
      if (dependencies && dependencies[0]) {
        pendingInfections.add(dependencies[0]);
      }
      return undefined;
    }

    if (requestExplicitlyInfected) {
      result.request = cleanRequest;
    }

    if (dependencies && dependencies[0]) {
      pendingInfections.add(dependencies[0]);
    }

    return undefined;
  });

  nmf.hooks.afterResolve.tap(PLUGIN_NAME, (result) => {
    if (!result) return undefined;

    const shouldInfect =
      result.dependencies &&
      result.dependencies[0] &&
      pendingInfections.has(result.dependencies[0]);

    if (!shouldInfect) return undefined;

    const resolvedResource = result.resource;

    if (hasSpecialQuery(resolvedResource) || !isInfectable(resolvedResource)) return undefined;

    const cleanPath = stripQuery(resolvedResource);
    infectedFiles.add(cleanPath);

    result.resource = appendVue3(resolvedResource);
    result.request = rebuildRequest(result.loaders, result.resource);
    result.userRequest = result.resource;

    return undefined;
  });
};

const applyStatsReporting = (compiler) => {
  compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
    compilation.hooks.finishModules.tap(PLUGIN_NAME, (modules) => {
      const infected = new Set();
      const clean = new Set();

      modules.forEach((mod) => {
        if (!mod.resource) return;
        const cleanPath = stripQuery(mod.resource);
        if (hasVue3Query(mod.resource)) {
          infected.add(cleanPath);
        } else {
          clean.add(cleanPath);
        }
      });

      const duplicated = [...infected].filter((p) => clean.has(p));
      console.log(
        `[vue3-infection] total: ${modules.length}, ` +
          `infected: ${infected.size}, duplicated: ${duplicated.length}`,
      );
    });
  });
};

class WebpackVue3InfectionPlugin {
  // eslint-disable-next-line class-methods-use-this
  apply(compiler) {
    const infectedFiles = new Set();
    const resolvedTargets = resolveAliasTargets();

    compiler.hooks.normalModuleFactory.tap(PLUGIN_NAME, (nmf) => {
      applyInfectionResolving(nmf, infectedFiles, resolvedTargets);
    });

    applyStatsReporting(compiler);
  }
}

module.exports = WebpackVue3InfectionPlugin;

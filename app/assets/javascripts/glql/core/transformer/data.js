import { omit } from 'lodash';

const dataSourceTransformers = {
  issues: (data) => (data.project || data.group).issues,
  mergeRequests: (data) => (data.project || data.group).mergeRequests,
  workItems: (data) => {
    const { workItems } = structuredClone(data.project || data.group);
    for (const workItem of workItems.nodes || []) {
      for (const widget of workItem.widgets || []) {
        Object.assign(workItem, omit(widget, ['type', '__typename']));
      }
      delete workItem.widgets;
    }

    return workItems;
  },
};

const transformForDataSource = (data) => {
  for (const [source, transformer] of Object.entries(dataSourceTransformers)) {
    const transformed = transformer(data);
    if (transformed) return { source, transformed };
  }
  return undefined;
};

const transformField = (data, field) => {
  if (field.transform)
    return {
      ...data,
      nodes: data.nodes.map((node) => field.transform(node)),
    };
  return data;
};

const transformFields = (data, fields) => {
  return fields.reduce((acc, field) => transformField(acc, field), data);
};

export const transform = (data, config) => {
  let source = config.source || 'issues';
  let transformed = data;

  ({ transformed, source } = transformForDataSource(transformed) || {});
  transformed = transformFields(transformed, config.fields);

  // eslint-disable-next-line no-param-reassign
  if (source) config.source = source;
  return transformed;
};

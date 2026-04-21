import { rest } from 'msw';
import { handleWorkItemOperation, workItemRestEndpoints } from './work_items/handlers';

// Thin router: Import feature handlers here
const graphqlFeatureHandlers = [handleWorkItemOperation];

// Collect all REST endpoints from feature handlers
const restEndpoints = [...workItemRestEndpoints];

const restEndpointsHandlers = restEndpoints.map((endpoint) =>
  rest[endpoint.method](endpoint.path, (req, res, ctx) => {
    return res(ctx.json(endpoint.response));
  }),
);

export const handlers = [
  // Single GraphQL endpoint that routes to feature handlers
  rest.post('http://test.host/api/graphql', (req, res, ctx) => {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { operationName, variables } = body;

    for (const handler of graphqlFeatureHandlers) {
      const result = handler({ operationName, variables, res, ctx });
      if (result) return result;
    }

    // eslint-disable-next-line no-console
    console.log(`No handler for operationName: ${operationName}`);
    return res(ctx.status(400));
  }),

  ...restEndpointsHandlers,

  rest.get('*', (req, res, ctx) => {
    // eslint-disable-next-line no-console
    console.log(`Unhandled url for REST endpoint: ${req.url.href}`);
    return res(ctx.status(400));
  }),
];

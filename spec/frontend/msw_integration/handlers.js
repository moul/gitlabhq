import { rest } from 'msw';
import { handleWorkItemOperation } from './handlers/work_items';

const featureHandlers = [handleWorkItemOperation];

export const handlers = [
  rest.post('http://test.host/api/graphql', (req, res, ctx) => {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { operationName, variables } = body;

    for (const handler of featureHandlers) {
      const result = handler({ operationName, variables, res, ctx });
      if (result) return result;
    }

    // eslint-disable-next-line no-console
    console.log(`No handler for operationName: ${operationName}`);
    return res(ctx.status(400));
  }),
];

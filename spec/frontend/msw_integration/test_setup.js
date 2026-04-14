import { fetch, Request, Response, Headers } from '@whatwg-node/fetch';
import { server } from './server';

jest.mock('~/actioncable_consumer', () => ({
  __esModule: true,
  default: {
    subscriptions: {
      create: jest.fn(() => ({
        unsubscribe: jest.fn(),
        perform: jest.fn(),
      })),
    },
  },
}));

global.fetch = fetch;
global.Request = Request;
global.Response = Response;
global.Headers = Headers;

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

beforeEach(() => {});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => server.close());

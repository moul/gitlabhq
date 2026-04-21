import { setupServer } from 'msw/node';
import { buildHandlers } from 'jest/msw_integration/handlers';
import { featureHandlers, restEndpoints } from 'ee_else_ce_jest/msw_integration/handlers';

// Setup requests interception in Node
export const server = setupServer(...buildHandlers(featureHandlers, restEndpoints));

import axios from '~/lib/utils/axios_utils';
import {
  normalizeHeaders,
  parseCursorPagination,
  parseIntPagination,
} from '~/lib/utils/common_utils';
import { formatGroupForGraphQLResolver } from '~/vue_shared/components/groups_list/formatter';
import { PAGINATION_TYPE_KEYSET } from '~/groups_projects/constants';

export const resolvers = (endpoint) => ({
  Query: {
    async groups(_, { active, search: filter, sort, parentId, pagination, page, before, after }) {
      const { data, headers } = await axios.get(endpoint, {
        params: {
          active,
          filter,
          sort,
          parent_id: parentId,
          cursor: before || after,
          pagination,
          page,
        },
      });

      const normalizedHeaders = normalizeHeaders(headers);

      // Placeholder to ensure all fields are defined during the transition
      // TODO: Remove after rollout https://gitlab.com/gitlab-org/gitlab/-/work_items/592061
      const basePageInfo = {
        __typename: 'LocalPageInfo',
        perPage: NaN,
        page: NaN,
        total: NaN,
        totalPages: NaN,
        nextPage: NaN,
        previousPage: NaN,
        startCursor: NaN,
        endCursor: NaN,
        hasNextPage: NaN,
        hasPreviousPage: NaN,
      };

      const pageInfo =
        pagination === PAGINATION_TYPE_KEYSET
          ? parseCursorPagination(normalizedHeaders)
          : parseIntPagination(normalizedHeaders);

      return {
        nodes: data.map(formatGroupForGraphQLResolver),
        pageInfo: {
          ...basePageInfo,
          ...pageInfo,
        },
      };
    },
  },
});

import Vue from 'vue';
import VueApollo from 'vue-apollo';
import createDefaultClient from '~/lib/graphql';
import App from './components/app.vue';

export default () => {
  const el = document.getElementById('js-explore-analytics-dashboards');

  if (!el) {
    return false;
  }

  Vue.use(VueApollo);
  const apolloProvider = new VueApollo({
    defaultClient: createDefaultClient(),
  });

  return new Vue({
    el,
    name: 'AnalyticsDashboardsRoot',
    apolloProvider,
    render(h) {
      return h(App);
    },
  });
};

<script>
import { TOTAL_DAYS_TO_SHOW } from '../constants';
import ChartsConfig from './charts_config';
import UsageCounts from './usage_counts.vue';
import UsageTrendsCountChart from './usage_trends_count_chart.vue';
import UsersChart from './users_chart.vue';

export default {
  name: 'UsageTrendsApp',
  components: {
    UsageCounts,
    UsageTrendsCountChart,
    UsersChart,
  },
  TOTAL_DAYS_TO_SHOW,
  configs: ChartsConfig,
};
</script>

<template>
  <div>
    <usage-counts />
    <users-chart :total-data-points="$options.TOTAL_DAYS_TO_SHOW" />
    <usage-trends-count-chart
      v-for="chartOptions in $options.configs"
      :key="chartOptions.chartTitle"
      :queries="chartOptions.queries"
      :x-axis-title="chartOptions.xAxisTitle"
      :y-axis-title="chartOptions.yAxisTitle"
      :load-chart-error-message="chartOptions.loadChartError"
      :no-data-message="chartOptions.noDataMessage"
      :chart-title="chartOptions.chartTitle"
    />
  </div>
</template>

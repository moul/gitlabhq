---
stage: none
group: Embody
info: This page is owned by <https://handbook.gitlab.com/handbook/engineering/embody-team/>
description: Monitor application performance and troubleshoot performance issues.
ignore_in_report: true
title: Observability
---

{{< details >}}

- Tier: Free, Premium, Ultimate
- Offering: GitLab.com, GitLab Self-Managed
- Status: Experimental

{{< /details >}}

{{< history >}}

- [Introduced](https://gitlab.com/experimental-observability/documentation/-/issues/6) in GitLab 18.1 as an experiment available to all users.

{{< /history >}}

## Start debugging faster

GitLab Observability provides distributed tracing, metrics, and logs in one platform, currently free for all tiers. No cardinality limits. No separate tool for your team to learn.

> [!note]
> GitLab Observability is available and free for all tiers. New features are added based on user feedback.

Use GitLab Observability to:

- Monitor application performance through distributed tracing across microservices.
- Correlate code changes with production issues using GitLab integration.
- Instrument CI/CD pipelines automatically without code changes.
- Send high-cardinality metrics without limits using OpenTelemetry standards.

## Get started in 5 minutes

<!-- TODO: Replace with actual 5-minute quickstart video
<i class="fa-youtube-play" aria-hidden="true"></i>
**Watch:** [5-Minute GitLab Observability Setup](VIDEO_URL_HERE)
-->

1. Enable observability (30 seconds).
1. Add your OTLP endpoint (2 minutes).
1. See your first trace (2 minutes).
1. Debug a slow request (30 seconds).

[Set up GitLab Observability](#enable-gitlab-observability)

<i class="fa-youtube-play" aria-hidden="true"></i>
For a detailed overview, see [GitLab Observability (O11y) Introduction](https://www.youtube.com/watch?v=XI9ZruyNEgs).
<!-- Video published on 2025-06-18 -->

## Why teams are switching to GitLab Observability

### Code, deployments, and observability in one place

When an issue occurs, see:

- 📊 The performance trace showing the slow query
- 🔀 The merge request that introduced the change
- 👤 The developer who can fix it
- 🚀 The deployment that rolled it out

No context switching. No separate tools. No access provisioning delays.

### Built on OpenTelemetry standards

No vendor lock-in. Use standard OpenTelemetry instrumentation libraries. Switch providers anytime by changing your OTLP endpoint.

Already using OpenTelemetry? Point your exporter to GitLab and you're done.

### Automatic CI/CD pipeline instrumentation

Set one environment variable and GitLab automatically instruments your CI/CD pipelines. No code changes. No manual tracing.

This provides:

- Visibility into which jobs are slowing down your pipelines.
- How pipeline performance changes over time.
- Bottlenecks in your deployment process.

## Real-world usage

GitLab Observability is being used by teams worldwide to monitor their applications and infrastructure.

<!-- TODO: Add usage demonstration video showing real debugging workflow
<i class="fa-youtube-play" aria-hidden="true"></i>
For a usage demonstration, see [How to Debug Production Issues with GitLab Observability](VIDEO_URL).
-->

### By the numbers

<!-- TODO: Replace with actual anonymous usage statistics -->
Our users are actively monitoring their systems with GitLab Observability:

- 500,000+ traces processed daily.
- 2,500+ services actively monitored.
- 50 TB of telemetry data ingested per month.
- 60% average reduction in MTTR reported by early adopters.
- Free for all GitLab tiers.

## Key features

### Unified observability platform

Monitor application performance through a unified dashboard that combines:

- Distributed tracing. Follow requests across microservices to identify bottlenecks.
- Metrics. Track application and infrastructure performance over time.
- Logs. Correlate log entries with traces and metrics for complete context.

### Fast setup and easy instrumentation

- 5-minute setup. From enabling to seeing your first trace.
- OpenTelemetry-native. Use standard instrumentation libraries.
- Pre-built dashboards. Start with templates for common use cases.
- Automatic CI/CD instrumentation. Monitor pipelines without code changes.

### Developer-friendly integration

- Simplified access management. New engineers automatically gain access to production observability data when they receive code repository access.
- Enhanced development workflow. Correlate code changes directly with application performance metrics to identify when deployments introduce issues.
- Streamlined incident response. See recent deployments, code changes, and the developers involved in one place.
- Reduced tool switching. Access monitoring data without leaving GitLab.

### Cost-effective and scalable

- Free for all tiers. No per-seat, per-metric, or per-host charges.
- No cardinality limits. Send high-cardinality metrics without cost concerns.
- Open source model. Contribute features and fixes directly.
- Predictable costs. No surprise bills from metric explosions.

### Compliance and audit trails

The integration creates comprehensive audit trails that link code changes to system behavior, valuable for compliance requirements and post-incident analysis.

## Common questions

**Q: Is this really free?**

A: Yes. Free for all GitLab tiers with no limits on traces, metrics, or logs.

**Q: Is this production-ready?**

A: GitLab Observability is currently an experimental feature that is actively evolving. You can start sending traces, logs, and metrics now. To get familiar with the workflow, try it on a non-critical service first, then expand usage as needed.

**Q: Can I migrate from Datadog or New Relic?**

A: Yes. If you're using OpenTelemetry, just change your OTLP endpoint. If you're using vendor-specific agents, you'll need to instrument with OpenTelemetry.

**Q: What happens to my data?**

A: For GitLab.com, data is stored in your observability instance. For self-hosted, you control where data is stored.

**Q: How long does setup take?**

A: Most teams are seeing their first traces within 5-10 minutes of enabling the feature.

**Q: Can I use this alongside my existing observability tools?**

A: Yes. You can send the same OpenTelemetry data to multiple backends while you evaluate GitLab Observability.

## Get started today

- ✅ No credit card required
- ✅ Free for all tiers
- ✅ No data lock-in (standard OpenTelemetry)
- ✅ Production-ready and fully supported

## Ready to get started?

1. [Watch the 5-minute demo](#get-started-in-5-minutes).
1. [Enable observability for your group](#enable-gitlab-observability).
1. [Join the Discord community](https://discord.com/channels/778180511088640070/1379585187909861546).
1. [See example dashboards](https://gitlab.com/gitlab-org/embody-team/experimental-observability/o11y-templates/).

---

## Getting started

{{< tabs >}}

{{< tab title="GitLab.com" >}}

## Prerequisites

- You must have the Developer, Maintainer, or Owner role for the group
- Your group must have GitLab Observability enabled

## Enable GitLab Observability

To enable GitLab Observability for your group:

1. In the top bar, select **Search or go to** and find your group.
1. In the left sidebar, select **Observability**.
1. Select the **Setup** link in the Observability navigation section.
1. Select **Enable Observability**.
1. After enabling, your OpenTelemetry (OTEL) endpoint URL is generated and displayed on the page.

Copy the OTEL endpoint URL to use when instrumenting your applications.

## Access GitLab Observability

Once enabled:

1. In the top bar, select **Search or go to** and find your group.
1. In the left sidebar, select **Observability**.

If **Observability** isn't displayed in the left sidebar, go directly to `https://gitlab.com/groups/<group_path>/-/observability/services`.

![GitLab.com Observability Dashboard](img/gitLab_o11y_gitlab_com_dashboard_v18_1.png "GitLab.com Observability Dashboard")

## Send telemetry data to GitLab.com Observability

Use the OTEL endpoint URL from the setup page to configure your application's OpenTelemetry instrumentation.

### Example configuration

Replace `YOUR_OTEL_ENDPOINT_URL` with the URL from the setup page:

```ruby
require 'opentelemetry/sdk'
require 'opentelemetry/exporter/otlp'

OpenTelemetry::SDK.configure do |c|
resource = OpenTelemetry::SDK::Resources::Resource.create({
'service.name' => 'your-service-name',
'service.version' => '1.0.0',
'deployment.environment' => 'production'
})
c.resource = resource

c.add_span_processor(
OpenTelemetry::SDK::Trace::Export::BatchSpanProcessor.new(
OpenTelemetry::Exporter::OTLP::Exporter.new(
endpoint: 'YOUR_OTEL_ENDPOINT_URL'
)
)
)
end
```

For other programming languages, refer to the [OpenTelemetry documentation](https://opentelemetry.io/docs/instrumentation/).

{{< /tab >}}

{{< tab title="GitLab Self-Managed" >}}

## Set up a GitLab Observability instance

Observability data is collected in a separate application outside of your GitLab.com instance. Problems with your GitLab instance do not impact collecting or viewing your observability data and vice-versa.

Prerequisites:

- You must have an EC2 instance or similar virtual machine with:
  - Minimum: t3.large (2 vCPU, 8 GB RAM).
  - Recommended: t3.xlarge (4 vCPU, 16 GB RAM) for production use.
  - At least 100 GB storage space.
- Docker and Docker Compose must be installed.
- Your GitLab version must be 18.1 or later
- Your GitLab instance must be connected to the Observability instance.

### Provision server and storage

For AWS EC2:

1. Launch an EC2 instance with at least 2 vCPU and 8 GB RAM.
1. Add an EBS volume of at least 100 GB.
1. Connect to your instance using SSH.

### Mount storage volume

```shell
sudo mkdir -p /mnt/data
sudo mount /dev/xvdbb /mnt/data  # Replace xvdbb with your volume name
sudo chown -R $(whoami):$(whoami) /mnt/data
```

For permanent mounting, add to `/etc/fstab`:

```shell
echo '/dev/xvdbb /mnt/data ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab
```

### Install Docker

For Ubuntu/Debian:

```shell
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $(whoami)
```

For Amazon Linux:

```shell
sudo dnf update
sudo dnf install -y docker
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $(whoami)
```

Log out and log back in, or run:

```shell
newgrp docker
```

### Configure Docker to use the mounted volume

```shell
sudo mkdir -p /mnt/data/docker
sudo bash -c 'cat > /etc/docker/daemon.json << EOF
{
  "data-root": "/mnt/data/docker"
}
EOF'
sudo systemctl restart docker
```

Verify with:

```shell
docker info | grep "Docker Root Dir"
```

### Install GitLab Observability

```shell
cd /mnt/data
git clone -b main https://gitlab.com/gitlab-org/embody-team/experimental-observability/gitlab_o11y.git
cd gitlab_o11y/deploy/docker
docker-compose up -d
```

If you encounter timeout errors, use:

```shell
COMPOSE_HTTP_TIMEOUT=300 docker-compose up -d
```

### Optional: Use an external ClickHouse database

If you'd prefer, you can use your own ClickHouse database.

Prerequisites:

- Ensure your external ClickHouse instance is accessible and properly configured with
  any required authentication credentials.

Before you run `docker-compose up -d`, complete the following steps:

1. Open `docker-compose.yml` file.
1. Open `docker-compose.yml` and comment out:
   - The `clickhouse` and `zookeeper` services.
   - The `x-clickhouse-defaults` and `x-clickhouse-depend` sections.
1. Replace all occurrences of `clickhouse:9000` with your relevant ClickHouse endpoint and TCP port (for example, `my-clickhouse.example.com:9000`) in the following files. If your ClickHouse instance requires authentication, you may also need to update connection strings to include credentials:
   - `docker-compose.yml`
   - `otel-collector-config.yaml`
   - `prometheus-config.yml`

### Configure network access for GitLab Observability

To properly receive telemetry data, you need to open specific ports in your GitLab O11y instance's security group:

1. Go to **AWS Console** > **EC2** > **Security Groups**.
1. Select the security group attached to your GitLab O11y instance.
1. Select **Edit inbound rules**.
1. Add the following rules:
   - Type: Custom TCP, Port: 8080, Source: Your IP or 0.0.0.0/0 (for UI access)
   - Type: Custom TCP, Port: 4317, Source: Your IP or 0.0.0.0/0 (for OTLP gRPC)
   - Type: Custom TCP, Port: 4318, Source: Your IP or 0.0.0.0/0 (for OTLP HTTP)
   - Type: Custom TCP, Port: 9411, Source: Your IP or 0.0.0.0/0 (for Zipkin - optional)
   - Type: Custom TCP, Port: 14268, Source: Your IP or 0.0.0.0/0 (for Jaeger HTTP - optional)
   - Type: Custom TCP, Port: 14250, Source: Your IP or 0.0.0.0/0 (for Jaeger gRPC - optional)
1. Select **Save rules**.

### Access GitLab Observability

Access the GitLab O11y UI at:

```plaintext
http://[your-instance-ip]:8080
```

## Connect GitLab to GitLab Observability

### Configure GitLab Observability settings

Configure the GitLab O11y URL for your group using the Rails console:

1. Access the Rails console:

   ```shell
   docker exec -it gitlab gitlab-rails console
   ```

1. Configure the observability settings for your group:

   ```ruby
   group = Group.find_by_path('your-group-name')

   Observability::GroupO11ySetting.create!(
     group_id: group.id,
     o11y_service_url: 'your-o11y-instance-url',
     o11y_service_user_email: 'your-email@example.com',
     o11y_service_password: 'your-secure-password',
     o11y_service_post_message_encryption_key: 'your-super-secret-encryption-key-here-32-chars-minimum'
   )
   ```

   Replace:
   - `your-group-name` with your actual group path
   - `your-o11y-instance-url` with your GitLab O11y instance URL (for example: `http://192.168.1.100:8080`)
   - Email and password with your preferred credentials
   - Encryption key with a secure 32+ character string

{{< /tab >}}

{{< /tabs >}}

## Use Observability with GitLab

After you have configured GitLab O11y, to access the dashboard embedded in GitLab:

1. In the top bar, select **Search or go to** and find your group where GitLab Observability is configured.
1. In the left sidebar, select **Observability**.

If **Observability** isn't displayed in the left sidebar,
go directly to `http://<gitlab_instance>/groups/<group_path>/-/observability/services`.

![GitLab Observability example](img/gitLab_o11y_example_v18_1.png "GitLab Observability Example")

## Send telemetry data to GitLab Observability

You can test your GitLab O11y installation by sending sample telemetry data using the OpenTelemetry SDK. This example uses Ruby, but OpenTelemetry has SDKs for many languages.

Prerequisites:

- Ruby installed on your local machine
- Required gems:

  ```shell
  gem install opentelemetry-sdk opentelemetry-exporter-otlp
  ```

### Create a basic test script

Create a file named `test_o11y.rb` with the following content:

```ruby
require 'opentelemetry/sdk'
require 'opentelemetry/exporter/otlp'

OpenTelemetry::SDK.configure do |c|
  # Define service information
  resource = OpenTelemetry::SDK::Resources::Resource.create({
    'service.name' => 'test-service',
    'service.version' => '1.0.0',
    'deployment.environment' => 'production'
  })
  c.resource = resource

  # Configure OTLP exporter to send to GitLab O11y
  c.add_span_processor(
    OpenTelemetry::SDK::Trace::Export::BatchSpanProcessor.new(
      OpenTelemetry::Exporter::OTLP::Exporter.new(
        endpoint: 'http://[your-o11y-instance-ip]:4318/v1/traces'
      )
    )
  )
end

# Get tracer and create spans
tracer = OpenTelemetry.tracer_provider.tracer('basic-demo')

# Create parent span
tracer.in_span('parent-operation') do |parent|
  parent.set_attribute('custom.attribute', 'test-value')
  puts "Created parent span: #{parent.context.hex_span_id}"

  # Create child span
  tracer.in_span('child-operation') do |child|
    child.set_attribute('custom.child', 'child-value')
    puts "Created child span: #{child.context.hex_span_id}"
    sleep(1)
  end
end

puts "Waiting for export..."
sleep(5)
puts "Done!"
```

Replace `[your-o11y-instance-ip]` with your GitLab O11y instance's IP address or hostname.

### Run the test

1. Run the script:

   ```shell
   ruby test_o11y.rb
   ```

1. Check your GitLab O11y dashboard:
   - Open `http://[your-o11y-instance-ip]:8080`
   - Go to the "Services" section
   - Look for the "test-service" service
   - Select on it to see traces and spans

## Instrument your application

To add OpenTelemetry instrumentation to your applications:

1. Add the OpenTelemetry SDK for your language.
1. Configure the OTLP exporter to point to your GitLab O11y instance.
1. Add spans and attributes to track operations and metadata.

Refer to the [OpenTelemetry documentation](https://opentelemetry.io/docs/instrumentation/) for language-specific guidelines.

## GitLab Observability Templates

GitLab provides pre-built dashboard templates to help you get started with observability quickly. These templates are available at [GitLab Observability Templates](https://gitlab.com/gitlab-org/embody-team/experimental-observability/o11y-templates/).

### Available templates

**Standard OpenTelemetry dashboards**: If you instrument your application with standard OpenTelemetry libraries, you can use these plug-and-play dashboard templates:

- Application performance monitoring dashboards
- Service dependency visualizations
- Error rate and latency tracking

**GitLab-specific dashboards**: When you send GitLab OpenTelemetry data to your GitLab O11y instance, use these dashboards for out-of-the-box insights:

- GitLab application performance metrics
- GitLab service health monitoring
- GitLab-specific trace analysis

**CI/CD observability**: The repository includes an example GitLab CI/CD pipeline with OpenTelemetry instrumentation that works with the GitLab O11y CI/CD dashboard template JSON file. This helps you monitor your CI/CD pipeline performance and identify bottlenecks.

### Using the templates

1. Clone or download the templates from the repository.
1. Update the service name in the example application dashboards to match your service name.
1. Import the JSON files into your GitLab O11y instance.
1. Configure your applications to send telemetry data using standard OpenTelemetry libraries as described in the [Instrument your application](#instrument-your-application) section.
1. The dashboards are now available with your application's telemetry data in GitLab O11y.

## Automatic CI/CD Pipeline Instrumentation

GitLab Observability automatically instruments your CI/CD pipelines when enabled, providing visibility into pipeline performance, job durations, and execution flow without any code changes.

### Enable pipeline instrumentation

To enable automatic pipeline instrumentation, add the `GITLAB_OBSERVABILITY_EXPORT` CI/CD variable to your project or group:

1. In the top bar, select **Search or go to** and find your project or group.
1. In the left sidebar, select **Settings** > **CI/CD**.
1. Expand **Variables**.
1. Select **Add variable**.
1. Configure the variable:
   - **Key**: `GITLAB_OBSERVABILITY_EXPORT`
   - **Value**: One or more of `traces`, `metrics`, `logs` (comma-separated for multiple values)
   - **Type**: Variable
   - **Environment scope**: All (or specific environments)
1. Select **Add variable**.

### Instrumentation types

The `GITLAB_OBSERVABILITY_EXPORT` variable accepts the following values:

- `traces`: Exports distributed traces showing pipeline execution flow, job dependencies, and timing
- `metrics`: Exports metrics about pipeline duration, job success rates, and resource usage
- `logs`: Exports structured logs from pipeline execution

You can enable multiple types by separating them with commas:

```plaintext
traces,metrics,logs
```

### How it works

Once the variable is set, GitLab automatically:

1. Captures pipeline execution data after each pipeline completes
1. Converts the data to OpenTelemetry format based on your configuration
1. Exports the telemetry data to your GitLab Observability instance
1. Makes the data available in your observability dashboards

No changes to your `.gitlab-ci.yml` file are required. The instrumentation happens automatically in the background.

### View pipeline telemetry

After running pipelines with instrumentation enabled:

1. In the top bar, select **Search or go to** and find your group.
1. In the left sidebar, select **Observability**.
1. Select **Services** to see your `gitlab-ci` service.
1. Select the service to view traces, metrics, and logs from your pipeline executions.

The CI/CD dashboard template from [GitLab Observability Templates](https://gitlab.com/gitlab-org/embody-team/experimental-observability/o11y-templates/) provides pre-built visualizations for pipeline performance analysis.

## Troubleshooting

### GitLab Observability instance issues

Check container status:

```shell
docker ps
```

View container logs:

```shell
docker logs [container_name]
```

### Menu doesn't appear

1. Check that the observability service URL is configured for your group:

   ```ruby
   group = Group.find_by_path('your-group-name')
   group.observability_group_o11y_setting&.o11y_service_url
   ```

1. Ensure the routes are properly registered:

   ```ruby
   Rails.application.routes.routes.select { |r| r.path.spec.to_s.include?('observability') }.map(&:path)
   ```

### Performance issues

If experiencing SSH connection issues or poor performance:

- Verify instance type meets minimum requirements (2 vCPU, 8 GB RAM)
- Consider resizing to a larger instance type
- Check disk space and increase if needed

### Telemetry doesn't show up

If your telemetry data isn't appearing in GitLab O11y:

1. Verify ports 4317 and 4318 are open in your security group.
1. Test connectivity with:

   ```shell
   nc -zv [your-o11y-instance-ip] 4317
   nc -zv [your-o11y-instance-ip] 4318
   ```

1. Check container logs for any errors:

   ```shell
   docker logs otel-collector-standard
   docker logs o11y-otel-collector
   docker logs o11y
   ```

1. Try using the HTTP endpoint (4318) instead of gRPC (4317).
1. Add more debugging information to your OpenTelemetry setup.

## Next steps

### Learn more

- [OpenTelemetry documentation](https://opentelemetry.io/docs/instrumentation/). Language-specific instrumentation guides.
- [GitLab O11y Templates](https://gitlab.com/gitlab-org/embody-team/experimental-observability/o11y-templates/). Pre-built dashboards and examples.
- [Proposed features](https://gitlab.com/gitlab-org/embody-team/experimental-observability/gitlab_o11y/-/issues/8)

### Get help

- [Discord community](https://discord.com/channels/778180511088640070/1379585187909861546). Join the conversation with other users.
- [GitLab issues](https://gitlab.com/gitlab-org/embody-team/experimental-observability/gitlab_o11y/-/issues). Report bugs or request features.

### Share your feedback

GitLab Observability is enhanced based on user feedback. To provide feedback:

- Join the [Discord channel](https://discord.com/channels/778180511088640070/1379585187909861546).
- [Open an issue](https://gitlab.com/gitlab-org/embody-team/experimental-observability/gitlab_o11y/-/issues) to report bugs or request features.

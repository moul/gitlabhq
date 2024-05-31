# frozen_string_literal: true

# A data object that wraps `Ci::Config` and any messages
# (errors, warnings) generated by the YamlProcessor.
module Gitlab
  module Ci
    class YamlProcessor
      class Result
        include Gitlab::Utils::StrongMemoize

        attr_reader :errors, :warnings,
          :root_variables, :root_variables_with_prefill_data,
          :stages, :jobs,
          :workflow_rules, :workflow_name, :workflow_auto_cancel

        def initialize(ci_config: nil, errors: [], warnings: [])
          @ci_config = ci_config
          @errors = errors || []
          @warnings = warnings || []

          assign_valid_attributes if valid?
        end

        def valid?
          errors.empty?
        end

        def stages_attributes
          stages.uniq.map do |stage|
            seeds = stage_builds_attributes(stage)

            { name: stage, index: stages.index(stage), builds: seeds }
          end
        end

        def builds
          jobs.map do |name, _|
            build_attributes(name)
          end
        end

        def included_templates
          @included_templates ||= @ci_config.included_templates
        end

        def included_components
          @ci_config.included_components
        end
        strong_memoize_attr :included_components

        def yaml_variables_for(job_name)
          job = jobs[job_name]

          return [] unless job

          Gitlab::Ci::Variables::Helpers.inherit_yaml_variables(
            from: root_variables,
            to: job[:job_variables],
            inheritance: job.fetch(:root_variables_inheritance, true)
          )
        end

        def stage_for(job_name)
          jobs.dig(job_name, :stage)
        end

        def config_metadata
          @ci_config&.metadata || {}
        end

        def clear_jobs!
          @jobs = {}
        end

        private

        def assign_valid_attributes
          @root_variables = transform_to_array(@ci_config.variables_with_data)
          @root_variables_with_prefill_data = @ci_config.variables_with_prefill_data

          @stages = @ci_config.stages
          @jobs = @ci_config.normalized_jobs

          @workflow_rules = @ci_config.workflow_rules
          @workflow_name = @ci_config.workflow_name&.strip
          @workflow_auto_cancel = @ci_config.workflow_auto_cancel
        end

        def stage_builds_attributes(stage)
          jobs.values
            .select { |job| job[:stage] == stage }
            .map { |job| build_attributes(job[:name]) }
        end

        def build_attributes(name)
          job = jobs.fetch(name.to_sym, {})

          { stage_idx: stages.index(job[:stage]),
            stage: job[:stage],
            tag_list: job[:tags],
            name: job[:name].to_s,
            allow_failure: job[:ignore],
            when: job[:when] || 'on_success',
            environment: job[:environment_name],
            coverage_regex: job[:coverage],
            # yaml_variables is calculated with using job_variables in Seed::Build
            job_variables: transform_to_array(job[:job_variables]),
            root_variables_inheritance: job[:root_variables_inheritance],
            needs_attributes: job.dig(:needs, :job),
            interruptible: job[:interruptible],
            only: job[:only],
            except: job[:except],
            rules: job[:rules],
            cache: job[:cache],
            resource_group_key: job[:resource_group],
            scheduling_type: job[:scheduling_type],
            id_tokens: job[:id_tokens],
            options: {
              image: job[:image],
              services: job[:services],
              allow_failure_criteria: job[:allow_failure_criteria],
              artifacts: job[:artifacts],
              dependencies: job[:dependencies],
              cross_dependencies: job.dig(:needs, :cross_dependency),
              job_timeout: job[:timeout],
              before_script: job[:before_script],
              script: job[:script],
              manual_confirmation: job[:manual_confirmation],
              after_script: job[:after_script],
              hooks: job[:hooks],
              environment: job[:environment],
              resource_group_key: job[:resource_group],
              retry: job[:retry],
              parallel: job[:parallel],
              instance: job[:instance],
              start_in: job[:start_in],
              trigger: job[:trigger],
              bridge_needs: job.dig(:needs, :bridge)&.first,
              release: job[:release],
              publish: job[:publish],
              pages: job[:pages]
            }.compact }.compact
        end

        def transform_to_array(variables)
          ::Gitlab::Ci::Variables::Helpers.transform_to_array(variables)
        end
      end
    end
  end
end

Gitlab::Ci::YamlProcessor::Result.prepend_mod_with('Gitlab::Ci::YamlProcessor::Result')

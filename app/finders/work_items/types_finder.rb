# frozen_string_literal: true

module WorkItems
  class TypesFinder
    def initialize(container:)
      @container = container
    end

    def execute(name: nil, only_available: false)
      return [] if unavailable_container?

      # The provider now returns both system-defined and custom work item types when the
      # work_item_configurable_types feature flag is enabled. When disabled, it falls back
      # to system-defined types only for backward compatibility.

      # TODO: The `name` and `only_available` parameters are deprecated and will be removed in 19.0.
      # See https://gitlab.com/gitlab-org/gitlab/-/work_items/593038
      provider = ::WorkItems::TypesFramework::Provider.new(@container)
      return Array.wrap(provider.find_by_base_type(name)) if name.present? && !only_available
      return provider.all_ordered_by_name unless only_available

      allowed_type_names = provider.allowed_types.map { |type| type.base_type.to_s }
      filtered_names = name.present? ? allowed_type_names.intersection(Array.wrap(name)) : allowed_type_names
      provider.by_base_types_ordered_by_name(filtered_names)
    end

    private

    def unavailable_container?
      @container.blank? || @container.is_a?(Namespaces::UserNamespace)
    end
  end
end

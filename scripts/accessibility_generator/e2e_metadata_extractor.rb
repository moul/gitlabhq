# frozen_string_literal: true

require 'rubocop'

# Extracts metadata from E2E test files (test case URLs, it blocks, page interactions)
class E2EMetadataExtractor
  def initialize(gitlab_root)
    @gitlab_root = gitlab_root
  end

  def extract_metadata(e2e_tests)
    e2e_tests.each do |test|
      file_path = File.join(@gitlab_root, test['path'])
      next unless File.exist?(file_path)

      source = File.read(file_path)
      version = RUBY_VERSION[/^(\d+\.\d+)/, 1].to_f
      ast = RuboCop::AST::ProcessedSource.new(source, version).ast

      next unless ast

      # Initialize collectors
      @it_blocks = []
      @page_interactions = []
      @describe_context = nil

      # Traverse the AST to collect metadata
      process_node(ast)

      # Assign extracted metadata
      test['it_blocks'] = @it_blocks
      test['page_interactions'] = @page_interactions.uniq
      test['describe_context'] = @describe_context
    end
  end

  private

  def process_node(node)
    case node.type
    when :block
      process_block(node)
    when :send
      process_send(node)
    end

    # Recursively process child nodes
    node.each_child_node { |child| process_node(child) }
  end

  def process_block(node)
    parent = node.send_node
    method_name = parent.method_name

    case method_name
    when :it
      extract_it_block(node, parent)
    when :perform
      extract_perform_block(node)
    end
  end

  def process_send(node)
    _receiver, method_name, *args = *node

    case method_name
    when :describe
      extract_describe_context(args)
    when :visit!
      @page_interactions << 'visits project page'
    when :visit
      extract_visit_call(args)
    else
      extract_method_call(node)
    end
  end

  def extract_it_block(_node, parent)
    description_arg = parent.arguments.first
    return unless description_arg&.str_type?

    it_block = { 'description' => description_arg.value }

    # Look for testcase: keyword argument in any hash argument
    parent.arguments.each do |arg|
      next unless arg.hash_type?

      arg.each_pair do |key, value|
        if key.sym_type? && key.value == :testcase && value.str_type?
          it_block['testcase_url'] = value.value
          break
        end
      end
    end

    @it_blocks << it_block
  end

  def extract_perform_block(node)
    receiver = node.send_node.receiver
    return unless receiver&.const_type?

    # Extract Page:: interactions
    # Split the constant source (e.g., "Page::Project::Show" -> ["Page", "Project", "Show"])
    const_parts = receiver.source.split('::')

    return unless const_parts.first == 'Page'

    # Join the parts after "Page" with spaces and downcase
    # e.g., ["Project", "Show"] -> "project show"
    page_name = const_parts[1..].join(' ').downcase
    @page_interactions << "interacts with #{page_name}"
  end

  def extract_describe_context(args)
    @describe_context ||= args.first.value if args.first&.str_type?
  end

  def extract_visit_call(args)
    path = args.first&.value if args.first&.str_type?
    @page_interactions << "visits #{path}" if path
  end

  def extract_method_call(node)
    receiver = node.receiver
    method_name = node.method_name

    return unless receiver
    return if %i[perform expect aggregate_failures].include?(method_name)

    # Match patterns like: show.click_something, page.select_something
    if receiver.send_type? && %i[show page form file project].include?(receiver.method_name)
      method_str = method_name.to_s
      # Skip assertion methods
      return if method_str.start_with?('has_', 'have_')

      # Convert snake_case to human readable
      human_readable = method_str.tr('_', ' ')
      @page_interactions << human_readable
    end

    # Extract Flow:: calls
    return unless receiver.const_type? && receiver.const_name == 'Flow'

    action = method_name.to_s.tr('_', ' ')
    flow_name = 'flow'
    @page_interactions << "#{action} (#{flow_name})"
  end
end

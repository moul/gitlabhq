#!/usr/bin/env ruby
# frozen_string_literal: true

require 'gitlab/dangerfiles/commit_linter'

module Lint
  module CommitLinter
    COMMIT_MESSAGE_GUIDELINES =
      "https://docs.gitlab.com/development/contributing/merge_request_workflow/#commit-messages-guidelines"
    SHA_PATTERN = /\A[0-9a-f]{40}\z/
    CommitData = Struct.new(:message, :sha)

    module_function

    def run_command(cmd)
      output = `#{cmd}`
      [output, $?.success?] # -- backtick idiom
    end

    def lint_commit(commit)
      return if commit.message.to_s.strip.empty?

      linter = Gitlab::Dangerfiles::CommitLinter.new(commit)

      return if linter.fixup? || linter.merge? || linter.revert? || linter.suggestion?

      linter.lint
      linter if linter.failed?
    end

    def commits_from_file(file_path)
      unless file_path && File.exist?(file_path)
        warn "ERROR: Commit message file not found."
        exit 1
      end

      message = File.read(file_path)
        .lines
        .reject { |line| line.start_with?('#') }
        .join

      [CommitData.new(message, nil)]
    end

    def commits_from_git
      base_sha_output, base_success = run_command('git merge-base origin/master HEAD')
      base_sha = base_sha_output.strip
      unless base_success && base_sha.match?(SHA_PATTERN)
        warn "ERROR: Failed to determine merge base"
        exit 1
      end

      shas_output, shas_success = run_command("git rev-list #{base_sha}..HEAD")
      unless shas_success
        warn "ERROR: Failed to list commits"
        exit 1
      end

      shas = shas_output.split("\n")
      shas.map do |sha|
        output, = run_command("git log -1 --format='%h%n%B' #{sha}")
        short_sha, message = output.strip.split("\n", 2)
        CommitData.new(message.to_s.strip, short_sha)
      end
    end

    def run(argv)
      commits = argv[0] ? commits_from_file(argv[0]) : commits_from_git

      return 0 if commits.empty?

      failed_linters = commits.filter_map { |commit| lint_commit(commit) }

      return 0 if failed_linters.empty?

      warn "Commit message linting failed:\n\n"

      failed_linters.each do |linter|
        warn "Commit #{linter.commit.sha}:" if linter.commit.sha
        linter.problems.each_value do |problem_desc|
          warn "  - #{problem_desc}"
        end
        warn ""
      end

      warn "See #{COMMIT_MESSAGE_GUIDELINES}"
      1
    end
  end
end

exit Lint::CommitLinter.run(ARGV) if $PROGRAM_NAME == __FILE__

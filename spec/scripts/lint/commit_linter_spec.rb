# frozen_string_literal: true

require 'fast_spec_helper'
require 'tempfile'
require_relative '../../../scripts/lint/commit_linter'

RSpec.describe Lint::CommitLinter, feature_category: :tooling do
  let(:valid_message) { "Add a valid commit message here" }
  let(:commit_data) { described_class::CommitData.new(valid_message, 'abc1234') }

  describe '.run_command' do
    subject(:run_command) { described_class.run_command(cmd) }

    context 'with a successful command' do
      let(:cmd) { 'echo hello' }

      it 'returns output and true' do
        output, success = run_command
        expect(output.strip).to eq('hello')
        expect(success).to be true
      end
    end

    context 'with a failing command' do
      let(:cmd) { 'exit 1' }

      it 'returns empty output and false' do
        output, success = run_command
        expect(output).to eq('')
        expect(success).to be false
      end
    end
  end

  describe '.lint_commit' do
    subject(:result) { described_class.lint_commit(commit_data) }

    context 'with a valid commit message' do
      it { is_expected.to be_nil }
    end

    context 'with a subject that is too short' do
      let(:valid_message) { "Short" }

      it 'returns a failed linter' do
        expect(result).to be_a(Gitlab::Dangerfiles::CommitLinter)
        expect(result.problems).to include(:subject_too_short)
      end
    end

    context 'with a subject that is too long' do
      let(:valid_message) { "#{'A' * 73} extra words here" }

      it 'returns a failed linter' do
        expect(result).to be_a(Gitlab::Dangerfiles::CommitLinter)
        expect(result.problems).to include(:subject_too_long)
      end
    end

    context 'with a subject starting with lowercase' do
      let(:valid_message) { "add a valid commit message here" }

      it 'returns a failed linter' do
        expect(result).to be_a(Gitlab::Dangerfiles::CommitLinter)
        expect(result.problems).to include(:subject_starts_with_lowercase)
      end
    end

    context 'with a subject ending with a period' do
      let(:valid_message) { "Add a valid commit message here." }

      it 'returns a failed linter' do
        expect(result).to be_a(Gitlab::Dangerfiles::CommitLinter)
        expect(result.problems).to include(:subject_ends_with_a_period)
      end
    end

    context 'with a fixup commit' do
      let(:valid_message) { "fixup! Add a valid commit message here" }

      it { is_expected.to be_nil }
    end

    context 'with a squash commit' do
      let(:valid_message) { "squash! Add a valid commit message here" }

      it { is_expected.to be_nil }
    end

    context 'with a merge commit' do
      let(:valid_message) { "Merge branch 'feature' into 'main'" }

      it { is_expected.to be_nil }
    end

    context 'with a revert commit' do
      let(:valid_message) { 'Revert "Add a valid commit message here"' }

      it { is_expected.to be_nil }
    end

    context 'with a suggestion commit' do
      let(:valid_message) { "Apply 1 suggestion(s) to 1 file(s)" }

      it { is_expected.to be_nil }
    end
  end

  describe '.commits_from_file' do
    subject(:result) { described_class.commits_from_file(file_path) }

    context 'with a valid commit message file' do
      let(:tmpfile) { Tempfile.new('commit_msg') }
      let(:file_path) { tmpfile.path }

      before do
        tmpfile.write("Add a valid commit message\n\n# This is a comment\nBody of the commit\n")
        tmpfile.close
      end

      after do
        tmpfile.unlink
      end

      it 'returns an array with one CommitData' do
        expect(result).to be_an(Array)
        expect(result.length).to eq(1)
      end

      it 'strips comment lines from the message' do
        expect(result.first.message).not_to include('# This is a comment')
      end

      it 'preserves non-comment lines' do
        expect(result.first.message).to include("Add a valid commit message")
        expect(result.first.message).to include("Body of the commit")
      end

      it 'sets sha to nil' do
        expect(result.first.sha).to be_nil
      end
    end

    context 'when file does not exist' do
      let(:file_path) { '/nonexistent/path/commit_msg' }

      it 'exits with status 1' do
        expect { result }.to raise_error(SystemExit) { |e| expect(e.status).to eq(1) }
          .and output(/ERROR: Commit message file not found/).to_stderr
      end
    end

    context 'when file_path is nil' do
      let(:file_path) { nil }

      it 'exits with status 1' do
        expect { result }.to raise_error(SystemExit) { |e| expect(e.status).to eq(1) }
          .and output(/ERROR: Commit message file not found/).to_stderr
      end
    end
  end

  describe '.commits_from_git' do
    subject(:result) { described_class.commits_from_git }

    let(:merge_base_sha) { 'a' * 40 }
    let(:commit_sha) { 'b' * 40 }

    def stub_commands(commands)
      allow(described_class).to receive(:run_command) do |cmd|
        matched = commands.find { |pattern, _| cmd.include?(pattern) }
        raise "Unexpected command: #{cmd}" unless matched

        matched.last
      end
    end

    context 'when git merge-base fails' do
      before do
        stub_commands('merge-base' => ['', false])
      end

      it 'exits with status 1' do
        expect { result }.to raise_error(SystemExit) { |e| expect(e.status).to eq(1) }
          .and output(/ERROR: Failed to determine merge base/).to_stderr
      end
    end

    context 'when git merge-base returns invalid SHA' do
      before do
        stub_commands('merge-base' => ["not-a-sha\n", true])
      end

      it 'exits with status 1' do
        expect { result }.to raise_error(SystemExit) { |e| expect(e.status).to eq(1) }
          .and output(/ERROR: Failed to determine merge base/).to_stderr
      end
    end

    context 'when git rev-list fails' do
      before do
        stub_commands(
          'merge-base' => ["#{merge_base_sha}\n", true],
          'rev-list' => ['', false]
        )
      end

      it 'exits with status 1' do
        expect { result }.to raise_error(SystemExit) { |e| expect(e.status).to eq(1) }
          .and output(/ERROR: Failed to list commits/).to_stderr
      end
    end

    context 'when commits exist' do
      before do
        stub_commands(
          'merge-base' => ["#{merge_base_sha}\n", true],
          'rev-list' => ["#{commit_sha}\n", true],
          'git log' => ["abc1234\nAdd a valid commit message", true]
        )
      end

      it 'returns an array of CommitData' do
        expect(result).to be_an(Array)
        expect(result.length).to eq(1)
        expect(result.first.sha).to eq('abc1234')
        expect(result.first.message).to eq('Add a valid commit message')
      end
    end

    context 'when no commits exist' do
      before do
        stub_commands(
          'merge-base' => ["#{merge_base_sha}\n", true],
          'rev-list' => ['', true]
        )
      end

      it 'returns an empty array' do
        expect(result).to eq([])
      end
    end
  end

  describe '.run' do
    subject(:run) { described_class.run(argv) }

    context 'in commit-msg mode' do
      let(:tmpfile) { Tempfile.new('commit_msg') }
      let(:argv) { [tmpfile.path] }

      after do
        tmpfile.unlink
      end

      context 'with a valid commit message' do
        before do
          tmpfile.write("Add a valid commit message here\n")
          tmpfile.close
        end

        it { is_expected.to eq(0) }
      end

      context 'with an invalid commit message' do
        before do
          tmpfile.write("bad\n")
          tmpfile.close
        end

        it 'returns 1 and prints errors to stderr' do
          expect { expect(run).to eq(1) }
            .to output(/Commit message linting failed.*commit subject must contain at least 3 words/mi).to_stderr
        end
      end

      context 'with a fixup commit' do
        before do
          tmpfile.write("fixup! Add a valid commit message here\n")
          tmpfile.close
        end

        it { is_expected.to eq(0) }
      end

      context 'with only comment lines' do
        before do
          tmpfile.write("# This is a comment\n# Another comment\n")
          tmpfile.close
        end

        it 'returns 0 since empty messages are skipped' do
          is_expected.to eq(0)
        end
      end
    end

    context 'in pre-push mode' do
      let(:argv) { [] }

      context 'when there are no commits' do
        before do
          allow(described_class).to receive(:commits_from_git).and_return([])
        end

        it { is_expected.to eq(0) }
      end

      context 'when all commits are valid' do
        before do
          allow(described_class).to receive(:commits_from_git).and_return(
            [described_class::CommitData.new("Add a valid commit message", 'abc1234')]
          )
        end

        it { is_expected.to eq(0) }
      end

      context 'when some commits are invalid' do
        before do
          allow(described_class).to receive(:commits_from_git).and_return(
            [
              described_class::CommitData.new("Add a valid commit message", 'abc1234'),
              described_class::CommitData.new("bad", 'def5678')
            ]
          )
        end

        it 'returns 1 and includes the commit SHA in output' do
          expect { expect(run).to eq(1) }
            .to output(/Commit def5678:.*See #{Regexp.escape(described_class::COMMIT_MESSAGE_GUIDELINES)}/mo).to_stderr
        end
      end

      context 'when commits include fixup and invalid' do
        before do
          allow(described_class).to receive(:commits_from_git).and_return(
            [
              described_class::CommitData.new("fixup! Add something", 'abc1234'),
              described_class::CommitData.new("bad", 'def5678')
            ]
          )
        end

        it 'only reports the invalid commit' do
          expect { expect(run).to eq(1) }
            .to output(/Commit def5678:/).to_stderr
        end

        it 'does not report the fixup commit' do
          expect { run }.to output(/Commit message linting failed/).to_stderr
          # fixup commit should be skipped
        end
      end
    end

    context 'when commit-msg mode has no sha' do
      let(:tmpfile) { Tempfile.new('commit_msg') }
      let(:argv) { [tmpfile.path] }

      before do
        tmpfile.write("bad\n")
        tmpfile.close
      end

      after do
        tmpfile.unlink
      end

      it 'does not print a commit SHA line' do
        expect { run }.to output(/Commit message linting failed/).to_stderr
          .and output(exclude(/Commit \S+:/)).to_stderr
      end

      private

      RSpec::Matchers.define_negated_matcher :exclude, :match
    end
  end
end

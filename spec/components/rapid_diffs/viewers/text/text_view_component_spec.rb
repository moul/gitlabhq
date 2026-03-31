# frozen_string_literal: true

require "spec_helper"

RSpec.describe RapidDiffs::Viewers::Text::TextViewComponent, feature_category: :code_review_workflow do
  let_it_be(:diff_file) { build(:diff_file) }

  subject(:instance) { RapidDiffs::Viewers::Text::InlineViewComponent.new(diff_file: diff_file) }

  describe '#virtual_rendering_params' do
    it "returns an integer total_rows" do
      expect(instance.virtual_rendering_params[:total_rows]).to be_a(Integer)
    end

    describe 'rows_visibility' do
      it "returns nil by default" do
        expect(instance.virtual_rendering_params[:rows_visibility]).to be_nil
      end

      it "returns 'auto' for large diffs" do
        large_hunk = Gitlab::Diff::ViewerHunk.new(
          lines: Array.new(Gitlab::Diff::File::ROWS_CONTENT_VISIBILITY_THRESHOLD,
            diff_file.highlighted_diff_lines.first)
        )
        allow(diff_file).to receive(:viewer_hunks).and_return([large_hunk])
        expect(instance.virtual_rendering_params[:rows_visibility]).to eq('auto')
      end
    end
  end
end

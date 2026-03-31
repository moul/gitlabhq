# frozen_string_literal: true

module RapidDiffs
  module Viewers
    module Text
      class TextViewComponent < ViewerComponent
        def virtual_rendering_params
          @virtual_rendering_params ||= { total_rows: total_rows, rows_visibility: rows_visibility }
        end

        private

        def rows_visibility
          total_rows >= Gitlab::Diff::File::ROWS_CONTENT_VISIBILITY_THRESHOLD ? 'auto' : nil
        end
      end
    end
  end
end

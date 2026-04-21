# frozen_string_literal: true

module Gitlab
  module Database
    module LoadBalancing
      module Callbacks
        mattr_accessor :track_exception_proc
        def self.configure!
          yield(self)
        end

        def self.track_exception(ex)
          track_exception_proc&.call(ex)
        end
      end
    end
  end
end

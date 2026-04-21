# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Gitlab::Database::LoadBalancing::Callbacks, feature_category: :database do # rubocop: disable RSpec/EmptyExampleGroup -- necessary step to safely extract Load Balancer into gem.
  # Around each example, reset the state of the callbacks so that specs don't pollute state
  around do |example|
    track_exception_proc = described_class.track_exception_proc

    example.run

    described_class.configure! do |cb|
      cb.track_exception_proc = track_exception_proc
    end
  end
end

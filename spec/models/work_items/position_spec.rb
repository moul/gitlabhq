# frozen_string_literal: true

require 'spec_helper'

RSpec.describe WorkItems::Position, feature_category: :team_planning do
  let_it_be(:project) { create(:project) }

  describe 'associations' do
    it { is_expected.to belong_to(:work_item) }
    it { is_expected.to belong_to(:namespace) }
  end

  it 'ensures to use work_item namespace' do
    work_item = create(:work_item, project: project)
    position = build(:work_item_position, work_item: work_item, namespace: nil)

    expect(position).to be_valid
    expect(position.namespace).to eq(work_item.namespace)
  end
end

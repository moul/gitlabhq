# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Members::DeletionSchedule, feature_category: :seat_cost_management do
  let_it_be(:schedule) { create(:members_deletion_schedules) }

  describe 'associations' do
    it { is_expected.to belong_to(:namespace).required }
    it { is_expected.to belong_to(:user).required }
    it { is_expected.to belong_to(:scheduled_by).required }
  end

  describe 'validations' do
    it 'validates uniqueness of user and namespace' do
      new_schedule = build(:members_deletion_schedules, user: schedule.user, namespace: schedule.namespace)

      expect(new_schedule).to be_invalid
      expect(new_schedule.errors.full_messages).to eq ["User already scheduled for deletion"]
    end
  end

  describe '.exists_for?' do
    it 'returns true when a member deletion schedule exists for the given namespace and user' do
      expect(described_class.exists_for?(schedule.namespace, schedule.user)).to be true
    end

    it 'returns false the user does not match' do
      user = create(:user)

      expect(described_class.exists_for?(schedule.namespace, user)).to be false
    end

    it 'returns false when the group does not match' do
      group = create(:group)

      expect(described_class.exists_for?(group, schedule.user)).to be false
    end
  end
end

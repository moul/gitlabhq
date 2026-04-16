# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Organizations::Stateful, feature_category: :organization do
  using RSpec::Parameterized::TableSyntax

  let_it_be(:user) { create(:user) }
  let_it_be_with_reload(:organization) { create(:organization) }

  describe 'enums' do
    subject { organization }

    it 'defines state enum with correct values' do
      is_expected.to define_enum_for(:state)
        .with_values(active: 0, deletion_scheduled: 1, deletion_in_progress: 2)
        .without_instance_methods
    end
  end

  describe 'state machine' do
    subject { organization }

    it 'declares all expected states' do
      is_expected.to have_states :active, :deletion_scheduled, :deletion_in_progress
    end

    it 'has active as initial state' do
      expect(organization.state_name).to eq(:active)
    end

    describe 'valid transitions' do
      it { is_expected.to handle_events :schedule_deletion, when: :active }
      it { is_expected.to handle_events :start_deletion, when: :deletion_scheduled }
      it { is_expected.to handle_events :cancel_deletion, when: :deletion_scheduled }
      it { is_expected.to handle_events :cancel_deletion, when: :deletion_in_progress }
      it { is_expected.to handle_events :reschedule_deletion, when: :deletion_in_progress }
    end

    describe 'rejected transitions' do
      where(:from_state, :event) do
        :active               | :start_deletion
        :active               | :cancel_deletion
        :active               | :reschedule_deletion
        :deletion_scheduled   | :schedule_deletion
        :deletion_scheduled   | :reschedule_deletion
        :deletion_in_progress | :schedule_deletion
        :deletion_in_progress | :start_deletion
      end

      with_them do
        before do
          organization.update_column(:state, Organizations::Organization.states[from_state])
        end

        it "rejects #{params[:event]} from #{params[:from_state]}" do
          expect(organization.public_send(event)).to be false
        end
      end
    end
  end

  describe '#ensure_transition_user' do
    it 'prevents schedule_deletion without a transition_user' do
      expect(organization.schedule_deletion).to be false
      expect(organization.errors[:state])
        .to include('schedule_deletion transition needs transition_user')
    end

    it 'allows schedule_deletion with a transition_user' do
      expect { organization.schedule_deletion(transition_user: user) }
        .to change { organization.state_name }
        .from(:active)
        .to(:deletion_scheduled)
    end
  end

  describe '#set_deletion_schedule_data' do
    it 'sets deletion_scheduled_at on the detail' do
      freeze_time do
        organization.schedule_deletion(transition_user: user)

        expect(organization.organization_detail.deletion_scheduled_at)
          .to be_within(1.minute).of(Time.current)
      end
    end

    it 'stores deletion_scheduled_by_user_id in state_metadata' do
      organization.schedule_deletion(transition_user: user)

      expect(organization.organization_detail.state_metadata['deletion_scheduled_by_user_id'])
        .to eq(user.id)
    end
  end

  describe '#clear_deletion_schedule_data' do
    before do
      organization.schedule_deletion(transition_user: user)
    end

    it 'clears deletion_scheduled_at' do
      organization.cancel_deletion

      expect(organization.organization_detail.deletion_scheduled_at).to be_nil
    end

    it 'removes deletion_scheduled_by_user_id from state_metadata' do
      organization.cancel_deletion

      expect(organization.organization_detail.state_metadata)
        .not_to have_key('deletion_scheduled_by_user_id')
    end
  end

  describe '#update_state_metadata_on_failure' do
    it 'records error in state_metadata when transition is invalid' do
      expect { organization.cancel_deletion }.to change {
        organization.organization_detail.state_metadata['last_error']
      }.from(nil).to(a_string_including('Cannot transition'))
    end
  end
end

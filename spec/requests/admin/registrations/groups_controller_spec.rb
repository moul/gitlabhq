# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Admin::Registrations::GroupsController, feature_category: :onboarding do
  let_it_be(:admin) { create(:admin) }
  let_it_be(:regular_user) { create(:user) }

  describe 'GET /admin/registrations/groups/new' do
    subject(:get_new) { get new_admin_registrations_group_path }

    context 'when the feature flag is disabled' do
      before do
        stub_feature_flags(self_managed_welcome_onboarding: false)
        sign_in(admin)
      end

      it 'returns not found', :enable_admin_mode do
        get_new

        expect(response).to have_gitlab_http_status(:not_found)
      end
    end

    context 'when the feature flag is enabled' do
      context 'with an unauthenticated user' do
        it 'redirects to sign in' do
          get_new

          expect(response).to redirect_to(new_user_session_path)
        end
      end

      context 'with a non-admin user' do
        before do
          sign_in(regular_user)
        end

        it 'returns not found' do
          get_new

          expect(response).to have_gitlab_http_status(:not_found)
        end
      end

      context 'when admin mode is not enabled' do
        before do
          sign_in(admin)
        end

        it 'redirects to admin mode login' do
          get_new

          expect(response).to redirect_to(new_admin_session_path)
        end
      end

      context 'with an admin user', :enable_admin_mode do
        before do
          sign_in(admin)
        end

        it 'returns ok' do
          get_new

          expect(response).to have_gitlab_http_status(:ok)
        end
      end
    end
  end
end

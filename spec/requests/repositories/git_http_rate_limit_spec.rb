# frozen_string_literal: true

require 'spec_helper'

RSpec.describe 'Authenticated Git HTTP rate limiting', :clean_gitlab_redis_rate_limiting,
  feature_category: :source_code_management do
  include RackAttackSpecHelpers
  include WorkhorseHelpers

  let_it_be(:project) { create(:project, :repository, :public) }
  let_it_be(:user) { create(:user) }
  let_it_be(:token) { create(:personal_access_token, user: user) }

  let(:git_info_refs_path) { "/#{project.full_path}.git/info/refs" }
  let(:params) { { service: 'git-upload-pack' } }
  let(:headers) do
    WorkhorseHelpers
      .workhorse_internal_api_request_header
      .merge(basic_auth_headers(user, token))
  end

  def do_request
    get git_info_refs_path, params: params, headers: headers
  end

  describe 'LFS routes are not affected by the git_http_authenticated rate limiter' do
    let_it_be(:lfs_deprecated_path) { "/#{project.full_path}.git/info/lfs/objects/abc123" }

    before do
      stub_application_setting(
        throttle_authenticated_git_http_enabled: true,
        throttle_authenticated_git_http_requests_per_period: 1,
        throttle_authenticated_git_http_period_in_seconds: 60
      )
    end

    it 'does not throttle LFS requests even when the Git HTTP limit is exceeded' do
      3.times do
        get lfs_deprecated_path, headers: headers
        expect(response).not_to have_gitlab_http_status(:too_many_requests)
      end
    end
  end

  describe 'throttle_authenticated_git_http via ApplicationRateLimiter' do
    let(:requests_per_period) { 2 }
    let(:period_in_seconds) { 60 }

    context 'when rate limit is enabled' do
      before do
        stub_application_setting(
          throttle_authenticated_git_http_enabled: true,
          throttle_authenticated_git_http_requests_per_period: requests_per_period,
          throttle_authenticated_git_http_period_in_seconds: period_in_seconds
        )
      end

      context 'with password authentication' do
        let_it_be(:password) { 'a-valid-password-123' }
        let_it_be(:password_user) { create(:user, password: password) }
        let(:password_headers) do
          encoded = Base64.strict_encode64("#{password_user.username}:#{password}")
          WorkhorseHelpers
            .workhorse_internal_api_request_header
            .merge('HTTP_AUTHORIZATION' => "Basic #{encoded}")
        end

        it 'calls find_with_user_password exactly once per request' do
          expect(Gitlab::Auth).to receive(:find_with_user_password).once.and_call_original

          get git_info_refs_path, params: params, headers: password_headers
        end
      end

      it 'rejects requests over the rate limit' do
        requests_per_period.times do
          do_request
          expect(response).to have_gitlab_http_status(:ok)
        end

        do_request
        expect(response).to have_gitlab_http_status(:too_many_requests)
      end

      it 'allows different users to make requests independently' do
        requests_per_period.times do
          do_request
          expect(response).to have_gitlab_http_status(:ok)
        end

        different_user = create(:user)
        different_token = create(:personal_access_token, user: different_user)
        different_headers = WorkhorseHelpers
          .workhorse_internal_api_request_header
          .merge(basic_auth_headers(different_user, different_token))

        get git_info_refs_path, params: params, headers: different_headers
        expect(response).to have_gitlab_http_status(:ok)
      end

      it 'does not throttle unauthenticated requests with this rate limiter' do
        unauthenticated_headers = WorkhorseHelpers.workhorse_internal_api_request_header

        (requests_per_period + 1).times do
          get git_info_refs_path, params: params, headers: unauthenticated_headers
        end

        expect(response).not_to have_gitlab_http_status(:too_many_requests)
      end
    end

    context 'when rate limit is disabled' do
      before do
        stub_application_setting(
          throttle_authenticated_git_http_enabled: false,
          throttle_authenticated_git_http_requests_per_period: requests_per_period,
          throttle_authenticated_git_http_period_in_seconds: period_in_seconds
        )
      end

      it 'does not reject requests over the rate limit' do
        (requests_per_period + 2).times do
          do_request
          expect(response).to have_gitlab_http_status(:ok)
        end
      end
    end
  end
end

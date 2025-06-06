# frozen_string_literal: true

module MergeRequests
  class LinkLfsObjectsService < ::BaseProjectService
    BATCH_SIZE = 100

    def execute(merge_request, oldrev: merge_request.diff_base_sha, newrev: merge_request.diff_head_sha)
      return if merge_request.source_project == project
      return if no_changes?(oldrev, newrev)

      new_lfs_oids = lfs_oids(merge_request.source_project.repository, oldrev, newrev)
      return if new_lfs_oids.empty?

      valid_lfs_oids = filter_valid_lfs_oids(merge_request.source_project, new_lfs_oids)
      return if valid_lfs_oids.empty?

      Projects::LfsPointers::LfsLinkService
        .new(project)
        .execute(valid_lfs_oids)
    end

    private

    def no_changes?(oldrev, newrev)
      oldrev == newrev
    end

    def lfs_oids(source_repository, oldrev, newrev)
      Gitlab::Git::LfsChanges
        .new(source_repository, newrev)
        .new_pointers(not_in: [oldrev])
        .map(&:lfs_oid)
    end

    def filter_valid_lfs_oids(source_project, new_lfs_oids)
      new_lfs_oids.each_slice(BATCH_SIZE).flat_map { |g| source_project.valid_lfs_oids(g) }.uniq
    end
  end
end

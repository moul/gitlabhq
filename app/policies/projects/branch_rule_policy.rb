# frozen_string_literal: true

module Projects
  class BranchRulePolicy < BasePolicy
    delegate { @subject.project }
  end
end

Projects::BranchRulePolicy.prepend_mod

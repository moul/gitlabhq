# frozen_string_literal: true

# ThrottledTouch can be used to throttle the number of updates triggered by
# calling "touch" on an ActiveRecord model.
module ThrottledTouch
  # The amount of time to wait before "touch" can update a record again.
  TOUCH_INTERVAL = 1.minute

  def touch(*args, **kwargs)
    last_updated_at = updated_at_previously_was || updated_at
    super if (Time.zone.now - last_updated_at) > TOUCH_INTERVAL
  end
end

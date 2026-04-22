# frozen_string_literal: true

module ActiveContext
  class Queues
    def self.queues
      register_all_queues!

      Set.new(@queue_classes_map.keys)
    end

    def self.raw_queues
      register_all_queues!
      build_raw_queues
    end

    def self.configured_queue_classes
      ActiveContext::Config.queue_classes
    end

    def self.build_raw_queues
      queues = []

      @queue_classes_map.each_value do |queue_class|
        shards_from_redis = discover_shards_from_redis(queue_class.redis_key)
        configured_shards = (0...queue_class.number_of_shards).to_a
        all_shards = (configured_shards + shards_from_redis).uniq.sort

        all_shards.each do |shard|
          queues << queue_class.new(shard)
        end
      end

      queues
    end

    def self.discover_shards_from_redis(redis_key_prefix)
      shards = []

      ActiveContext::Redis.with_redis do |redis|
        pattern = "#{redis_key_prefix}:*:zset"

        redis.scan_each(match: pattern) do |key|
          shard_number = extract_shard_number(key, redis_key_prefix)
          shards << shard_number if shard_number
        end
      end

      shards.uniq.sort
    rescue StandardError => e
      ActiveContext::Logger.warn(
        message: 'Failed to discover shards from Redis',
        error: e.message,
        redis_key_prefix: redis_key_prefix
      )
      []
    end

    def self.extract_shard_number(redis_key, redis_key_prefix)
      # Extract shard number from key like "prefix:{queue}:0:zset"
      match = redis_key.match(/\A#{Regexp.escape(redis_key_prefix)}:(\d+):zset\z/)
      match[1].to_i if match
    end

    def self.register_all_queues!
      return if @queues_registered

      configured_queue_classes.each do |q|
        register!(q)
      end

      register!(RetryQueue)

      @queues_registered = true
    end

    def self.register!(queue_class)
      key = queue_class.redis_key

      @queue_classes_map ||= {}

      return if @queue_classes_map.key?(key)

      @queue_classes_map[key] = queue_class
    end

    def self.all_queued_items
      {}.tap do |hash|
        raw_queues&.each do |raw_queue|
          queue_key = "#{raw_queue.redis_key}:zset"
          references = ActiveContext::Redis.with_redis do |redis|
            redis.zrangebyscore(queue_key, '-inf', '+inf')
          end
          hash[queue_key] = references if references.present?
        end
      end
    end

    def self.queue_counts
      queue_counts = []

      raw_queues&.each do |raw_queue|
        queue_key = "#{raw_queue.redis_key}:zset"
        count = ActiveContext::Redis.with_redis do |redis|
          redis.zcard(queue_key)
        end

        queue_counts << { queue_name: raw_queue.class.name, shard: raw_queue.shard, count: count }
      end

      queue_counts
    end
  end
end

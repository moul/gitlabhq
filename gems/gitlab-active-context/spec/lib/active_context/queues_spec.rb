# frozen_string_literal: true

RSpec.describe ActiveContext::Queues do
  let(:test_queue_class) do
    Class.new do
      include ActiveContext::Concerns::Queue

      def self.name
        "TestModule::TestQueue"
      end

      def self.number_of_shards
        3
      end
    end
  end

  let(:redis) { instance_double(Redis) }

  before do
    stub_const('TestModule::TestQueue', test_queue_class)
    allow(ActiveContext::Redis).to receive(:with_redis).and_yield(redis)
    allow(redis).to receive(:scan_each)

    described_class.instance_variable_set(:@queue_classes_map, nil)
    described_class.instance_variable_set(:@queues_registered, nil)
  end

  describe '.register!' do
    it 'registers the queue class' do
      expect(described_class.queues).to contain_exactly('activecontext:{retry_queue}')
      expect(described_class.raw_queues.size).to eq(1)

      described_class.register!(test_queue_class)

      expect(described_class.queues.size).to eq(2)
      expect(described_class.queues).to include('testmodule:{test_queue}')
    end

    it 'creates instances for each shard' do
      expect { described_class.register!(test_queue_class) }.to change { described_class.raw_queues.size }.by(3)

      raw_queues = described_class.raw_queues
      expect(raw_queues.size).to eq(4)
      test_queue_instances = raw_queues.select { |q| q.is_a?(test_queue_class) }
      expect(test_queue_instances.size).to eq(3)
      expect(test_queue_instances.map(&:shard)).to eq([0, 1, 2])
    end

    it 'does not register the same queue class twice' do
      described_class.register!(test_queue_class)
      expect { described_class.register!(test_queue_class) }.not_to change { described_class.queues.size }
      expect { described_class.register!(test_queue_class) }.not_to change { described_class.raw_queues.size }
    end

    it 'adds the correct key to the queues set' do
      described_class.register!(test_queue_class)
      expect(described_class.queues.first).to eq('testmodule:{test_queue}')
    end
  end

  describe 'configured queues registration' do
    before do
      allow(ActiveContext::Config).to receive(:queue_classes).and_return(
        [
          test_queue_class,
          Test::Queues::Mock
        ]
      )
    end

    def length_raw_queues_for_class(klass)
      described_class.raw_queues.count { |q| q.is_a?(klass) }
    end

    describe '.configured_queue_classes' do
      it 'returns the configured queued classes' do
        expect(described_class.configured_queue_classes).to eq ActiveContext::Config.queue_classes
      end
    end

    describe '.register_all_queues!' do
      it 'registers all configured queues' do
        described_class.register_all_queues!

        expect(described_class.queues).to eq Set.new(['testmodule:{test_queue}', "test_queues:{mock}",
          "activecontext:{retry_queue}"])

        expect(described_class.raw_queues.length).to eq 8
        expect(length_raw_queues_for_class(Test::Queues::Mock)).to eq Test::Queues::Mock.number_of_shards
        expect(length_raw_queues_for_class(test_queue_class)).to eq test_queue_class.number_of_shards
      end

      it 'only calls register! for each queue class once' do
        allow(described_class).to receive(:register!).and_call_original
        expect(described_class).to receive(:register!).with(Test::Queues::Mock).once
        expect(described_class).to receive(:register!).with(test_queue_class).once
        expect(described_class).to receive(:register!).with(ActiveContext::RetryQueue).once

        described_class.register_all_queues!
        described_class.register_all_queues!
        described_class.register_all_queues!
      end
    end

    context 'when calling .raw_queues' do
      it 'builds queue instances from configured classes' do
        expect(described_class.raw_queues.length).to eq 8
        expect(length_raw_queues_for_class(Test::Queues::Mock)).to eq Test::Queues::Mock.number_of_shards
        expect(length_raw_queues_for_class(test_queue_class)).to eq test_queue_class.number_of_shards
      end

      it 'dynamically reflects changes to number_of_shards' do
        # Initial call - should have 3 shards
        expect(length_raw_queues_for_class(test_queue_class)).to eq 3

        # Simulate shard count increase (e.g., admin updates queue_shard_count)
        allow(test_queue_class).to receive(:number_of_shards).and_return(5)

        # Next call should pick up the new shard count immediately
        expect(length_raw_queues_for_class(test_queue_class)).to eq 5
      end

      it 'processes existing shards in Redis even when shard count decreases' do
        # Simulate having items in shards 0, 1, 2 in Redis
        allow(redis).to receive(:scan_each).and_yield('testmodule:{test_queue}:0:zset')
                                           .and_yield('testmodule:{test_queue}:1:zset')
                                           .and_yield('testmodule:{test_queue}:2:zset')

        # Initial queues with 3 shards
        expect(length_raw_queues_for_class(test_queue_class)).to eq 3

        # Decrease shard count to 1
        allow(test_queue_class).to receive(:number_of_shards).and_return(1)

        # Should still process all 3 existing shards (0, 1, 2) even though configured is 1
        # This prevents orphaning items when decreasing shard count
        expect(length_raw_queues_for_class(test_queue_class)).to eq 3
      end

      it 'handles Redis scan failure gracefully' do
        allow(redis).to receive(:scan_each).and_raise(StandardError.new('Redis error'))
        allow(ActiveContext::Logger).to receive(:warn)

        # Should fall back to configured shards only
        expect(length_raw_queues_for_class(test_queue_class)).to eq 3
        expect(ActiveContext::Logger).to have_received(:warn).at_least(:once).with(
          hash_including(message: 'Failed to discover shards from Redis')
        )
      end
    end

    describe '.discover_shards_from_redis' do
      it 'returns empty array when no matching keys found' do
        allow(redis).to receive(:scan_each)

        shards = described_class.discover_shards_from_redis('nonexistent:key')

        expect(shards).to eq([])
      end

      it 'extracts shard numbers from matching keys' do
        allow(redis).to receive(:scan_each).and_yield('testmodule:{test_queue}:0:zset')
                                           .and_yield('testmodule:{test_queue}:5:zset')
                                           .and_yield('testmodule:{test_queue}:2:zset')

        shards = described_class.discover_shards_from_redis('testmodule:{test_queue}')

        expect(shards).to eq([0, 2, 5])
      end

      it 'ignores non-matching keys' do
        allow(redis).to receive(:scan_each).and_yield('testmodule:{test_queue}:0:zset')
                                           .and_yield('testmodule:{other_queue}:1:zset')
                                           .and_yield('testmodule:{test_queue}:0:score')

        shards = described_class.discover_shards_from_redis('testmodule:{test_queue}')

        expect(shards).to eq([0])
      end
    end

    describe '.extract_shard_number' do
      it 'extracts shard number from valid key' do
        shard = described_class.extract_shard_number(
          'testmodule:{test_queue}:5:zset',
          'testmodule:{test_queue}'
        )

        expect(shard).to eq(5)
      end

      it 'returns nil for non-matching key' do
        shard = described_class.extract_shard_number(
          'other:{queue}:5:zset',
          'testmodule:{test_queue}'
        )

        expect(shard).to be_nil
      end

      it 'returns nil for key without shard number' do
        shard = described_class.extract_shard_number(
          'testmodule:{test_queue}:zset',
          'testmodule:{test_queue}'
        )

        expect(shard).to be_nil
      end
    end

    context 'when calling .queues' do
      it 'calls register_all_queues!' do
        expect(described_class).to receive(:register_all_queues!).at_least(:once).and_call_original

        expect(described_class.queues).to eq Set.new(['testmodule:{test_queue}', "test_queues:{mock}",
          "activecontext:{retry_queue}"])
      end
    end
  end

  describe '.all_queued_items' do
    before do
      allow(ActiveContext::Config).to receive(:queue_classes).and_return(
        [
          test_queue_class,
          Test::Queues::Mock
        ]
      )
    end

    it 'picks up all the queued items' do
      allow(ActiveContext::Hasher).to receive(:consistent_hash).and_return(0, 1, 0)

      expect(redis).to receive(:incrby).with('testmodule:{test_queue}:0:score', 1).and_return(1)
      expect(redis).to receive(:incrby).with('test_queues:{mock}:0:score', 1).and_return(3)
      expect(redis).to receive(:incrby).with('test_queues:{mock}:1:score', 1).and_return(2)
      expect(redis).to receive(:zadd).with('testmodule:{test_queue}:0:zset', [[1, 'ref1']])
      expect(redis).to receive(:zadd).with('test_queues:{mock}:0:zset', [[3, 'ref3']])
      expect(redis).to receive(:zadd).with('test_queues:{mock}:1:zset', [[2, 'ref2']])

      allow(redis).to receive(:zrangebyscore).and_return([])
      expect(redis).to receive(:zrangebyscore)
        .with('testmodule:{test_queue}:0:zset', '-inf', '+inf')
        .and_return([['ref1', 1]])
      expect(redis).to receive(:zrangebyscore)
        .with('test_queues:{mock}:0:zset', '-inf', '+inf')
        .and_return([['ref3', 3]])
      expect(redis).to receive(:zrangebyscore)
        .with('test_queues:{mock}:1:zset', '-inf', '+inf')
        .and_return([['ref2', 2]])

      test_queue_class.push(['ref1'])
      Test::Queues::Mock.push(%w[ref2 ref3])

      expect(described_class.all_queued_items).to eq({
        'testmodule:{test_queue}:0:zset' => [['ref1', 1]],
        'test_queues:{mock}:0:zset' => [['ref3', 3]],
        'test_queues:{mock}:1:zset' => [['ref2', 2]]
      })
    end
  end

  describe '.queue_counts' do
    before do
      allow(ActiveContext::Config).to receive(:queue_classes).and_return([test_queue_class])
    end

    it 'returns counts for all queue shards' do
      allow(redis).to receive(:zcard).with('testmodule:{test_queue}:0:zset').and_return(4)
      allow(redis).to receive(:zcard).with('testmodule:{test_queue}:1:zset').and_return(0)
      allow(redis).to receive(:zcard).with('testmodule:{test_queue}:2:zset').and_return(2)
      allow(redis).to receive(:zcard).with('activecontext:{retry_queue}:0:zset').and_return(0)

      result = described_class.queue_counts

      expect(result).to contain_exactly(
        { queue_name: 'TestModule::TestQueue', shard: 0, count: 4 },
        { queue_name: 'TestModule::TestQueue', shard: 1, count: 0 },
        { queue_name: 'TestModule::TestQueue', shard: 2, count: 2 },
        { queue_name: 'ActiveContext::RetryQueue', shard: 0, count: 0 }
      )
    end

    it 'returns an empty array when no queues are registered' do
      allow(ActiveContext::Config).to receive(:queue_classes).and_return([])
      allow(redis).to receive(:zcard).with('activecontext:{retry_queue}:0:zset').and_return(0)

      expect(described_class.queue_counts).to eq([
        { queue_name: 'ActiveContext::RetryQueue', shard: 0, count: 0 }
      ])
    end
  end
end

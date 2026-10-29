package dev.dashaun.gateway;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

/**
 * Where the global load balancer sent each write, and how long the caller waited.
 */
@Component
public class DemoMetrics {

	public record Event(long ts, String region, String type, long latencyMs) {
	}

	public record RegionSample(String name, long writes, double avgLatencyMs, List<Long> recentLatencies) {
	}

	private static final int MAX_RECENT = 60;
	private static final int MAX_EVENTS = 200;

	private final MeterRegistry meterRegistry;
	private final ConcurrentHashMap<String, AtomicLong> writes = new ConcurrentHashMap<>();
	private final ConcurrentHashMap<String, Deque<Long>> latencies = new ConcurrentHashMap<>();
	private final Deque<Event> events = new ArrayDeque<>();
	private final Counter failoverCounter;

	public DemoMetrics(MeterRegistry meterRegistry) {
		this.meterRegistry = meterRegistry;
		this.failoverCounter = Counter.builder("demo.failover.total")
				.description("Requests the global load balancer retried in another region")
				.register(meterRegistry);
	}

	public void recordWrite(String region, long elapsedMs) {
		writes.computeIfAbsent(region, k -> new AtomicLong()).incrementAndGet();
		synchronized (this) {
			Deque<Long> queue = latencies.computeIfAbsent(region, k -> new ArrayDeque<>());
			queue.addLast(elapsedMs);
			while (queue.size() > MAX_RECENT) {
				queue.removeFirst();
			}
		}
		Counter.builder("demo.region.writes").tag("region", region).register(meterRegistry).increment();
		Timer.builder("demo.region.write.time").tag("region", region).register(meterRegistry)
				.record(Duration.ofMillis(elapsedMs));
		pushEvent(region, "WRITE", elapsedMs);
	}

	public void recordFailover(String region, int retries) {
		failoverCounter.increment();
		pushEvent(region, "FAILOVER", retries);
	}

	public void recordState(String region, String state) {
		pushEvent(region, state, 0);
	}

	public long totalWrites() {
		return writes.values().stream().mapToLong(AtomicLong::get).sum();
	}

	public RegionSample regionSample(String name) {
		long count = writes.getOrDefault(name, new AtomicLong()).get();
		List<Long> recent;
		synchronized (this) {
			recent = new ArrayList<>(latencies.getOrDefault(name, new ArrayDeque<>()));
		}
		double avg = recent.isEmpty() ? 0 : recent.stream().mapToLong(Long::longValue).average().orElse(0);
		return new RegionSample(name, count, avg, recent);
	}

	public List<Event> events() {
		synchronized (this) {
			return new ArrayList<>(events);
		}
	}

	private void pushEvent(String region, String type, long latencyMs) {
		synchronized (this) {
			events.addLast(new Event(System.currentTimeMillis(), region, type, latencyMs));
			while (events.size() > MAX_EVENTS) {
				events.removeFirst();
			}
		}
	}
}

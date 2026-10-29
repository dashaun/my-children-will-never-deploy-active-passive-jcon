package dev.dashaun.gateway;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * The dashboard's view of the five regions: their configured weight and distance,
 * and whether each one's /actuator/health answers UP. Routing itself is done by
 * the load balancer's own health checks; this only reports.
 */
@Component
public class RegionDirectory {

	public record Region(String name, String url, long latencyMs, int weight) {
	}

	private static final Logger log = LoggerFactory.getLogger(RegionDirectory.class);

	private final DiscoveryClient discovery;
	private final DemoMetrics metrics;
	private final RestClient restClient;
	private final Map<String, Boolean> healthy = new ConcurrentHashMap<>();

	public RegionDirectory(DiscoveryClient discovery, DemoMetrics metrics) {
		this.discovery = discovery;
		this.metrics = metrics;
		JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory();
		requestFactory.setReadTimeout(Duration.ofSeconds(1));
		this.restClient = RestClient.builder().requestFactory(requestFactory).build();
	}

	public List<Region> regions() {
		return discovery.getInstances("regions").stream().map(RegionDirectory::toRegion).toList();
	}

	public boolean isHealthy(String name) {
		return healthy.getOrDefault(name, false);
	}

	public String fastRegionName() {
		return regions().stream().max(java.util.Comparator.comparingInt(Region::weight))
				.map(Region::name).orElse(null);
	}

	@Scheduled(fixedDelay = 1000)
	public void checkAll() {
		for (Region region : regions()) {
			boolean up;
			try {
				String body = restClient.get().uri(region.url() + "/actuator/health").retrieve().body(String.class);
				up = body != null && body.contains("\"status\":\"UP\"");
			}
			catch (Exception e) {
				up = false;
			}
			Boolean was = healthy.put(region.name(), up);
			if (was != null && was != up) {
				log.info("Region [{}] is {}", region.name(), up ? "UP" : "DOWN");
				metrics.recordState(region.name(), up ? "UP" : "DOWN");
			}
		}
	}

	private static Region toRegion(ServiceInstance instance) {
		Map<String, String> meta = instance.getMetadata();
		return new Region(meta.getOrDefault("region", instance.getInstanceId()), instance.getUri().toString(),
				Long.parseLong(meta.getOrDefault("latency-ms", "0")), Integer.parseInt(meta.getOrDefault("weight", "1")));
	}
}

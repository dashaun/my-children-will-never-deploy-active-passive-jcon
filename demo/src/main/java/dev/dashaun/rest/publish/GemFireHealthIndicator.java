package dev.dashaun.rest.publish;

import java.time.Duration;

import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * This region is only healthy while its own data grid answers. The global load
 * balancer health-checks /actuator/health, so a dead grid takes the region out
 * of rotation even if this app is still running.
 */
@Component
public class GemFireHealthIndicator implements HealthIndicator {

	private final RegionProperties region;
	private final RestClient restClient;

	public GemFireHealthIndicator(RegionProperties region) {
		this.region = region;
		SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
		requestFactory.setConnectTimeout(Duration.ofSeconds(1));
		requestFactory.setReadTimeout(Duration.ofSeconds(1));
		this.restClient = RestClient.builder().baseUrl(region.getGemfireUrl()).requestFactory(requestFactory).build();
	}

	@Override
	public Health health() {
		try {
			// GemFire's REST ping returns HTTP 200 (empty body) when the server is up
			restClient.get().uri("/gemfire-api/v1/ping").retrieve().toBodilessEntity();
			return Health.up().withDetail("region", region.getName()).build();
		}
		catch (Exception e) {
			return Health.down().withDetail("region", region.getName()).withException(e).build();
		}
	}
}

package dev.dashaun.gateway;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DashboardController {

	private final RegionDirectory directory;
	private final DemoMetrics metrics;

	public DashboardController(RegionDirectory directory, DemoMetrics metrics) {
		this.directory = directory;
		this.metrics = metrics;
	}

	@GetMapping("/sites")
	public List<Map<String, Object>> sites() {
		return directory.regions().stream()
				.map(region -> Map.<String, Object>of(
						"name", region.name(),
						"url", region.url(),
						"latencyMs", region.latencyMs(),
						"weight", region.weight(),
						"healthy", directory.isHealthy(region.name())))
				.toList();
	}

	@GetMapping("/dashboard")
	public Map<String, Object> dashboard() {
		List<Map<String, Object>> regions = directory.regions().stream()
				.map(region -> {
					DemoMetrics.RegionSample sample = metrics.regionSample(region.name());
					return Map.<String, Object>of(
							"name", region.name(),
							"url", region.url(),
							"latencyMs", region.latencyMs(),
							"weight", region.weight(),
							"healthy", directory.isHealthy(region.name()),
							"writes", sample.writes(),
							"avgLatencyMs", Math.round(sample.avgLatencyMs()),
							"recent", sample.recentLatencies());
				})
				.toList();

		double avg = directory.regions().stream()
				.map(region -> metrics.regionSample(region.name()))
				.filter(sample -> sample.writes() > 0)
				.mapToDouble(DemoMetrics.RegionSample::avgLatencyMs)
				.average().orElse(0);

		return Map.of(
				"mode", directory.isHealthy(directory.fastRegionName()) ? "NORMAL" : "DEGRADED",
				"regions", regions,
				"events", metrics.events(),
				"summary", Map.of(
						"totalWrites", metrics.totalWrites(),
						"avgLatencyMs", Math.round(avg)));
	}
}

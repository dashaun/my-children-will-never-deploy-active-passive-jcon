package dev.dashaun.gateway;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.cloud.gateway.filter.factory.RetryGatewayFilterFactory;
import org.springframework.core.Ordered;
import org.springframework.http.HttpMethod;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import reactor.core.publisher.Mono;

/**
 * Wraps every routed request, retries included, so the caller sees the total time
 * they waited (X-Latency-Ms) next to the region that finally served them (X-Region,
 * set by the regional app). Feeds the dashboard.
 */
@Component
public class RegionTrafficFilter implements GlobalFilter, Ordered {

	private final DemoMetrics metrics;

	public RegionTrafficFilter(DemoMetrics metrics) {
		this.metrics = metrics;
	}

	@Override
	public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
		long started = System.currentTimeMillis();
		// ./world warms up JIT and connections after (re)starts; keep that off the dashboard
		boolean warmup = exchange.getRequest().getHeaders().containsHeader("X-Warmup");
		ServerHttpResponse response = exchange.getResponse();
		response.beforeCommit(() -> {
			long elapsed = System.currentTimeMillis() - started;
			response.getHeaders().set("X-Latency-Ms", String.valueOf(elapsed));
			String region = response.getHeaders().getFirst("X-Region");
			if (!warmup && region != null && HttpMethod.POST.equals(exchange.getRequest().getMethod())
					&& response.getStatusCode() != null && response.getStatusCode().is2xxSuccessful()) {
				metrics.recordWrite(region, elapsed);
				Integer retries = exchange.getAttribute(RetryGatewayFilterFactory.RETRY_ITERATION_KEY);
				if (retries != null && retries > 0) {
					metrics.recordFailover(region, retries);
				}
			}
			return Mono.empty();
		});
		return chain.filter(exchange);
	}

	@Override
	public int getOrder() {
		return Ordered.HIGHEST_PRECEDENCE;
	}
}

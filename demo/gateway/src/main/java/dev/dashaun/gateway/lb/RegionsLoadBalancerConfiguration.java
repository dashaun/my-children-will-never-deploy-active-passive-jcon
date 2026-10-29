package dev.dashaun.gateway.lb;

import org.springframework.cloud.loadbalancer.core.ServiceInstanceListSupplier;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;

/**
 * Load balancer for lb://regions: start from the configured regions, drop any whose
 * health check fails, then spread traffic by each region's weight.
 *
 * Deliberately not @Configuration: Spring Cloud LoadBalancer loads it into the
 * "regions" child context only (see GatewayApplication).
 */
public class RegionsLoadBalancerConfiguration {

	@Bean
	ServiceInstanceListSupplier regionInstances(ConfigurableApplicationContext context) {
		return ServiceInstanceListSupplier.builder()
				.withDiscoveryClient()
				.withHealthChecks()
				.withWeighted()
				.build(context);
	}

}

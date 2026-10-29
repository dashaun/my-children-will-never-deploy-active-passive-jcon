package dev.dashaun.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.loadbalancer.annotation.LoadBalancerClient;
import org.springframework.scheduling.annotation.EnableScheduling;

import dev.dashaun.gateway.lb.RegionsLoadBalancerConfiguration;

@SpringBootApplication
@EnableScheduling
@LoadBalancerClient(name = "regions", configuration = RegionsLoadBalancerConfiguration.class)
public class GatewayApplication {

	public static void main(String[] args) {
		SpringApplication.run(GatewayApplication.class, args);
	}

}

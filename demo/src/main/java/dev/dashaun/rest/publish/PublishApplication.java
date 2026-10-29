package dev.dashaun.rest.publish;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(RegionProperties.class)
public class PublishApplication {

	public static void main(String[] args) {
		SpringApplication.run(PublishApplication.class, args);
	}

}

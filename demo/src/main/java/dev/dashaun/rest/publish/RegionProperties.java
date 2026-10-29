package dev.dashaun.rest.publish;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * The only thing that differs between the five regional deployments: which region
 * this instance is, and where that region's GemFire REST API lives.
 */
@ConfigurationProperties(prefix = "region")
public class RegionProperties {

	private String name = "region1";
	private String gemfireUrl = "http://localhost:7071";

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getGemfireUrl() {
		return gemfireUrl;
	}

	public void setGemfireUrl(String gemfireUrl) {
		this.gemfireUrl = gemfireUrl;
	}
}

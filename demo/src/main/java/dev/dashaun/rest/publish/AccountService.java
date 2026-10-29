package dev.dashaun.rest.publish;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

/**
 * Reads and writes go to this region's own GemFire cluster, never a remote one.
 * WAN replication moves the data between regions in the background.
 */
@Service
public class AccountService {

	private static final Logger log = LoggerFactory.getLogger(AccountService.class);

	private final RegionProperties region;
	private final RestClient restClient;

	public AccountService(RegionProperties region) {
		this.region = region;
		SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
		requestFactory.setConnectTimeout(Duration.ofSeconds(2));
		requestFactory.setReadTimeout(Duration.ofSeconds(5));
		this.restClient = RestClient.builder().baseUrl(region.getGemfireUrl()).requestFactory(requestFactory).build();
	}

	public void write(Account account) {
		try {
			restClient.put()
					.uri("/gemfire-api/v1/Account/{id}", account.getId())
					.contentType(MediaType.APPLICATION_JSON)
					.body(account)
					.retrieve()
					.toBodilessEntity();
			log.info("WROTE account [{}] -> {}", account.getId(), region.getName());
		}
		catch (ResourceAccessException | HttpStatusCodeException e) {
			throw localGridUnavailable(e);
		}
	}

	public Account read(String id) {
		try {
			return restClient.get()
					.uri("/gemfire-api/v1/Account/{id}", id)
					.retrieve()
					.body(Account.class);
		}
		catch (HttpStatusCodeException e) {
			if (e.getStatusCode().is4xxClientError()) {
				throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No account " + id + " in " + region.getName());
			}
			throw localGridUnavailable(e);
		}
		catch (ResourceAccessException e) {
			throw localGridUnavailable(e);
		}
	}

	// 503 tells the global load balancer to retry this request in another region
	private ResponseStatusException localGridUnavailable(Exception cause) {
		log.warn("{} GemFire unavailable: {}", region.getName(), cause.getClass().getSimpleName());
		return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
				region.getName() + " data grid is unavailable", cause);
	}
}

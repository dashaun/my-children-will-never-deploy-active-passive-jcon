package dev.dashaun.rest.publish;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/account")
public class AccountController {

	private final AccountService accountService;
	private final RegionProperties region;

	public AccountController(AccountService accountService, RegionProperties region) {
		this.accountService = accountService;
		this.region = region;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public Account createAccount(@RequestBody Account account, HttpServletResponse response) {
		accountService.write(account);
		response.setHeader("X-Region", region.getName());
		return account;
	}

	@GetMapping("/{id}")
	public Account getAccount(@PathVariable String id, HttpServletResponse response) {
		Account account = accountService.read(id);
		response.setHeader("X-Region", region.getName());
		return account;
	}
}

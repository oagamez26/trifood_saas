package com.potoquitos.saas.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final LoginService loginService;
    private final RefreshTokenService refreshTokenService;
    private final AuthCookieService cookieService;

    public AuthController(
            LoginService loginService,
            RefreshTokenService refreshTokenService,
            AuthCookieService cookieService) {
        this.loginService = loginService;
        this.refreshTokenService = refreshTokenService;
        this.cookieService = cookieService;
    }

    @PostMapping("/login")
    public LoginResponse login(
            @Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        LoginService.LoginResult result =
                loginService.login(request.username(), request.password(), request.tenantSlug());
        String csrfToken = cookieService.issueCsrfToken();
        cookieService.setRefreshCookies(
                response,
                result.tokens().refreshToken(),
                csrfToken,
                result.tokens().refreshLifetime().toSeconds());
        return new LoginResponse(
                result.tokens().accessToken(),
                "Bearer",
                result.accessTokenExpiresIn(),
                result.tokens().userId(),
                result.tokens().tenantId().toString());
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(
            HttpServletRequest request, HttpServletResponse response) {
        if (!cookieService.validateCsrf(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        RefreshTokenService.RefreshResult result =
                refreshTokenService.rotate(cookieService.refreshToken(request));
        if (result.status() != RefreshTokenService.RefreshStatus.ROTATED) {
            cookieService.clearRefreshCookies(response);
            throw new BadCredentialsException("Refresh token is invalid or expired");
        }
        var issued = result.tokens();
        String csrfToken = cookieService.issueCsrfToken();
        cookieService.setRefreshCookies(
                response,
                issued.refreshToken(),
                csrfToken,
                issued.refreshLifetime().toSeconds());
        return ResponseEntity.ok(
                new LoginResponse(
                        issued.accessToken(),
                        "Bearer",
                        issued.expiresIn(),
                        issued.userId(),
                        issued.tenantId().toString()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            HttpServletRequest request, HttpServletResponse response) {
        if (cookieService.hasRefreshCookie(request) && !cookieService.validateCsrf(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        refreshTokenService.revokeFamilyFor(cookieService.refreshToken(request));
        cookieService.clearRefreshCookies(response);
        return ResponseEntity.noContent().build();
    }

    public record LoginRequest(
            @NotBlank @Size(max = 80) @Pattern(regexp = "[A-Za-z0-9._-]{1,80}") String username,
            @NotBlank @Size(max = 128) String password,
            @Size(max = 80) @Pattern(regexp = "[A-Za-z0-9._-]{1,80}") String tenantSlug) {}

    public record LoginResponse(
            String accessToken, String tokenType, long expiresIn, long userId, String tenantId) {}
}

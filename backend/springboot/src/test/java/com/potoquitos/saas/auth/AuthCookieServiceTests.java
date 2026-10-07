package com.potoquitos.saas.auth;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class AuthCookieServiceTests {
    private final AuthCookieService service =
            new AuthCookieService(false, java.util.List.of("http://localhost:5173"));

    @Test
    void csrfRequiresAllowedOriginAndMatchingDoubleSubmitTokens() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Origin", "http://localhost:5173");
        request.addHeader(AuthCookieService.CSRF_HEADER, "csrf-value");
        request.setCookies(new Cookie(AuthCookieService.CSRF_COOKIE, "csrf-value"));

        assertThat(service.validateCsrf(request)).isTrue();

        MockHttpServletRequest attackerRequest = new MockHttpServletRequest();
        attackerRequest.addHeader("Origin", "https://attacker.example");
        attackerRequest.addHeader(AuthCookieService.CSRF_HEADER, "csrf-value");
        attackerRequest.setCookies(new Cookie(AuthCookieService.CSRF_COOKIE, "csrf-value"));
        assertThat(service.validateCsrf(attackerRequest)).isFalse();
    }

    @Test
    void csrfRejectsDifferentHeaderAndCookieTokens() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Origin", "http://localhost:5173");
        request.addHeader(AuthCookieService.CSRF_HEADER, "header-value");
        request.setCookies(new Cookie(AuthCookieService.CSRF_COOKIE, "cookie-value"));

        assertThat(service.validateCsrf(request)).isFalse();
    }
}

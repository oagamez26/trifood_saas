package com.potoquitos.saas.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class AuthCookieService {
    public static final String REFRESH_COOKIE = "trifood-refresh";
    public static final String CSRF_COOKIE = "trifood-csrf";
    public static final String CSRF_HEADER = "X-CSRF-TOKEN";
    private static final String AUTH_PATH = "/api/auth";
    private final boolean secure;
    private final List<String> allowedOrigins;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthCookieService(
            @Value("${app.auth.cookie-secure:true}") boolean secure,
            @Value("${app.cors.allowed-origins}") List<String> allowedOrigins) {
        this.secure = secure;
        this.allowedOrigins = List.copyOf(allowedOrigins);
    }

    public String issueCsrfToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public void setRefreshCookies(
            HttpServletResponse response, String refreshToken, String csrfToken, long maxAgeSeconds) {
        response.addHeader(
                HttpHeaders.SET_COOKIE,
                cookie(REFRESH_COOKIE, refreshToken, true, maxAgeSeconds).toString());
        response.addHeader(
                HttpHeaders.SET_COOKIE,
                cookie(CSRF_COOKIE, csrfToken, false, maxAgeSeconds).toString());
    }

    public void clearRefreshCookies(HttpServletResponse response) {
        response.addHeader(
                HttpHeaders.SET_COOKIE, cookie(REFRESH_COOKIE, "", true, 0).toString());
        response.addHeader(
                HttpHeaders.SET_COOKIE, cookie(CSRF_COOKIE, "", false, 0).toString());
    }

    public boolean validateCsrf(HttpServletRequest request) {
        if (request.getHeader(HttpHeaders.ORIGIN) == null
                || !allowedOrigins.contains(request.getHeader(HttpHeaders.ORIGIN))) {
            return false;
        }
        String header = request.getHeader(CSRF_HEADER);
        String cookie = csrfCookie(request);
        return header != null
                && cookie != null
                && MessageDigest.isEqual(
                        header.getBytes(StandardCharsets.UTF_8),
                        cookie.getBytes(StandardCharsets.UTF_8));
    }

    public String refreshToken(HttpServletRequest request) {
        return cookieValue(request, REFRESH_COOKIE);
    }

    public boolean hasRefreshCookie(HttpServletRequest request) {
        return refreshToken(request) != null;
    }

    private String csrfCookie(HttpServletRequest request) {
        return cookieValue(request, CSRF_COOKIE);
    }

    private static String cookieValue(HttpServletRequest request, String name) {
        if (request.getCookies() == null) {
            return null;
        }
        for (var cookie : request.getCookies()) {
            if (name.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private ResponseCookie cookie(String name, String value, boolean httpOnly, long maxAge) {
        ResponseCookie.ResponseCookieBuilder builder =
                ResponseCookie.from(name, value)
                        .path(AUTH_PATH)
                        .httpOnly(httpOnly)
                        .secure(secure)
                        .sameSite("Strict")
                        .maxAge(maxAge);
        return builder.build();
    }
}

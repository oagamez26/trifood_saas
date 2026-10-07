package com.potoquitos.saas.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtValidationException;

class AccessTokenServiceTests {
    private static final String SECRET = "0123456789abcdef0123456789abcdef";
    private static final Instant NOW = Instant.now();

    private final SecurityConfiguration configuration = new SecurityConfiguration();

    @Test
    void issuedTokenContainsIdentityAndTenantButNoAuthorizationClaims() {
        var encoder = configuration.jwtEncoder(SECRET);
        var service =
                new AccessTokenService(
                        encoder,
                        Clock.fixed(NOW, ZoneOffset.UTC),
                        Duration.ofMinutes(15));
        JwtDecoder decoder = configuration.jwtDecoder(SECRET);

        var jwt = decoder.decode(service.issue(42, UUID.randomUUID(), 3));

        assertThat(jwt.getSubject()).isEqualTo("42");
        assertThat(jwt.getClaims().get("user_id")).isEqualTo(42L);
        assertThat(jwt.getClaims().get("token_version")).isEqualTo(3L);
        assertThat(jwt.getClaims()).doesNotContainKeys("roles", "permissions");
    }

    @Test
    void decoderRejectsExpiredSignedJwt() {
        var encoder = configuration.jwtEncoder(SECRET);
        JwtDecoder decoder = configuration.jwtDecoder(SECRET);
        String expired =
                encoder.encode(
                                JwtEncoderParameters.from(
                                        JwsHeader.with(MacAlgorithm.HS256).build(),
                                        JwtClaimsSet.builder()
                                                .issuer("trifood")
                                                .subject("42")
                                                .issuedAt(NOW.minusSeconds(120))
                                                .expiresAt(NOW.minusSeconds(60))
                                                .claim("user_id", 42)
                                                .claim("tenant_id", UUID.randomUUID().toString())
                                                .claim("token_version", 0)
                                                .build()))
                        .getTokenValue();

        assertThatThrownBy(() -> decoder.decode(expired))
                .isInstanceOf(JwtValidationException.class);
    }
}

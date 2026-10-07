package com.potoquitos.saas.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;

@Service
public class AccessTokenService {
    private final JwtEncoder jwtEncoder;
    private final Clock clock;
    private final Duration lifetime;

    public AccessTokenService(
            JwtEncoder jwtEncoder,
            Clock clock,
            @Value("${security.jwt.access-token-ttl:PT15M}") Duration lifetime) {
        this.jwtEncoder = jwtEncoder;
        this.clock = clock;
        this.lifetime = requirePositiveLifetime(lifetime, "security.jwt.access-token-ttl");
    }

    public String issue(long userId, UUID tenantId, int tokenVersion) {
        Instant now = clock.instant();
        JwtClaimsSet claims =
                JwtClaimsSet.builder()
                        .issuer("trifood")
                        .subject(Long.toString(userId))
                        .issuedAt(now)
                        .expiresAt(now.plus(lifetime))
                        .claim("user_id", userId)
                        .claim("tenant_id", tenantId.toString())
                        .claim("token_version", tokenVersion)
                        .build();
        return jwtEncoder
                .encode(
                        JwtEncoderParameters.from(
                                JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
    }

    public long expiresInSeconds() {
        return lifetime.toSeconds();
    }

    private static Duration requirePositiveLifetime(Duration value, String property) {
        if (value == null || value.isZero() || value.isNegative()) {
            throw new IllegalArgumentException(property + " must be a positive duration");
        }
        return value;
    }
}

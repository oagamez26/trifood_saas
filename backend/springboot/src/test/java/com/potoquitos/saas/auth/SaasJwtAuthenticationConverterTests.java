package com.potoquitos.saas.auth;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;

import com.potoquitos.saas.shared.security.SaasPrincipal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.jwt.Jwt;

class SaasJwtAuthenticationConverterTests {
    private final SaasJwtAuthenticationConverter converter =
            new SaasJwtAuthenticationConverter();

    @Test
    void parsesIdentityClaimsButDoesNotTrustRoleClaimsAsAuthorities() {
        UUID tenantId = UUID.randomUUID();
        Jwt jwt =
                Jwt.withTokenValue("test-token")
                        .header("alg", "HS256")
                        .subject("42")
                        .claim("user_id", 42)
                        .claim("tenant_id", tenantId.toString())
                        .claim("roles", List.of("ADMINISTRADOR", "CAJERO"))
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(60))
                        .build();

        var authentication = converter.convert(jwt);

        assertThat(authentication.getPrincipal())
                .isEqualTo(
                        new SaasPrincipal(
                                42, tenantId, java.util.Set.of(), java.util.Set.of()));
        assertThat(authentication.getAuthorities()).isEmpty();
    }

    @Test
    void rejectsJwtWithoutTenantClaim() {
        Jwt jwt =
                Jwt.withTokenValue("test-token")
                        .header("alg", "HS256")
                        .subject("42")
                        .claim("user_id", 42)
                        .claim("roles", List.of("ADMINISTRADOR"))
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(60))
                        .build();

        assertThatThrownBy(() -> converter.convert(jwt))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void rejectsFractionalUserIds() {
        Jwt jwt =
                Jwt.withTokenValue("test-token")
                        .header("alg", "HS256")
                        .subject("42")
                        .claim("user_id", 42.5)
                        .claim("tenant_id", UUID.randomUUID().toString())
                        .claim("roles", List.of())
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(60))
                        .build();

        assertThatThrownBy(() -> converter.convert(jwt))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void rejectsSubjectThatDoesNotMatchUserId() {
        Jwt jwt =
                Jwt.withTokenValue("test-token")
                        .header("alg", "HS256")
                        .subject("43")
                        .claim("user_id", 42)
                        .claim("tenant_id", UUID.randomUUID().toString())
                        .claim("roles", List.of("ADMINISTRADOR"))
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(60))
                        .build();

        assertThatThrownBy(() -> converter.convert(jwt))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void ignoresRoleClaimsUntilMembershipAuthorizationLoadsDatabaseAuthorities() {
        Jwt jwt =
                Jwt.withTokenValue("test-token")
                        .header("alg", "HS256")
                        .subject("42")
                        .claim("user_id", 42)
                        .claim("tenant_id", UUID.randomUUID().toString())
                        .claim("roles", List.of("ADMINISTRADOR", "FORGED"))
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(60))
                        .build();

        var authentication = converter.convert(jwt);

        assertThat(authentication.getAuthorities()).isEmpty();
    }
}

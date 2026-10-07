package com.potoquitos.saas.auth;

import com.potoquitos.saas.shared.security.SaasPrincipal;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

@Component
public class SaasJwtAuthenticationConverter
        implements Converter<Jwt, AbstractAuthenticationToken> {
    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        long userId = positiveLongClaim(jwt, "user_id");
        if (!Long.toString(userId).equals(jwt.getSubject())) {
            throw new BadCredentialsException("JWT subject does not match user_id");
        }
        UUID tenantId = uuidClaim(jwt, "tenant_id");
        int tokenVersion = nonNegativeIntClaim(jwt, "token_version");
        SaasPrincipal principal =
                new SaasPrincipal(
                        userId, tenantId, tokenVersion, java.util.Set.of(), java.util.Set.of());
        return UsernamePasswordAuthenticationToken.authenticated(
                principal, jwt, java.util.Set.of());
    }

    private static long positiveLongClaim(Jwt jwt, String name) {
        Object value = jwt.getClaims().get(name);
        long parsed;
        try {
            parsed = new BigDecimal(String.valueOf(value)).longValueExact();
        } catch (NumberFormatException | ArithmeticException exception) {
            throw new BadCredentialsException("JWT claim user_id is invalid", exception);
        }
        if (parsed > 0) {
            return parsed;
        }
        throw new BadCredentialsException("JWT claim user_id is invalid");
    }

    private static UUID uuidClaim(Jwt jwt, String name) {
        Object value = jwt.getClaims().get(name);
        try {
            return UUID.fromString(String.valueOf(value));
        } catch (IllegalArgumentException exception) {
            throw new BadCredentialsException("JWT claim tenant_id is invalid", exception);
        }
    }

    private static int nonNegativeIntClaim(Jwt jwt, String name) {
        Object value = jwt.getClaims().get(name);
        if (value == null) {
            return 0;
        }
        try {
            int parsed = new BigDecimal(String.valueOf(value)).intValueExact();
            if (parsed >= 0) {
                return parsed;
            }
        } catch (NumberFormatException | ArithmeticException exception) {
            throw new BadCredentialsException("JWT claim token_version is invalid", exception);
        }
        throw new BadCredentialsException("JWT claim token_version is invalid");
    }
}

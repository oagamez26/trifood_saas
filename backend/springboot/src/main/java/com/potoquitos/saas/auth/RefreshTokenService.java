package com.potoquitos.saas.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RefreshTokenService {
    private static final int TOKEN_BYTES = 32;
    private final RefreshSessionRepository sessionRepository;
    private final AuthenticationUserRepository userRepository;
    private final TenantMembershipRepository membershipRepository;
    private final AccessTokenService accessTokenService;
    private final Clock clock;
    private final Duration lifetime;
    private final SecureRandom secureRandom = new SecureRandom();

    public RefreshTokenService(
            RefreshSessionRepository sessionRepository,
            AuthenticationUserRepository userRepository,
            TenantMembershipRepository membershipRepository,
            AccessTokenService accessTokenService,
            Clock clock,
            @Value("${security.jwt.refresh-token-ttl:P30D}") Duration lifetime) {
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.accessTokenService = accessTokenService;
        this.clock = clock;
        this.lifetime = requirePositiveLifetime(lifetime);
    }

    @Transactional
    public IssuedRefreshToken create(UUID tenantId, long userId) {
        int tokenVersion =
                userRepository
                        .tokenVersionForActiveMembership(tenantId, userId)
                        .orElseThrow(InvalidRefreshTokenException::new);
        String rawToken = randomToken();
        Instant now = clock.instant();
        sessionRepository.insert(
                UUID.randomUUID(),
                UUID.randomUUID(),
                tenantId,
                userId,
                hash(rawToken),
                now,
                now.plus(lifetime));
        return new IssuedRefreshToken(
                rawToken,
                accessTokenService.issue(userId, tenantId, tokenVersion),
                accessTokenService.expiresInSeconds(),
                lifetime,
                userId,
                tenantId);
    }

    @Transactional
    public RefreshResult rotate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return RefreshResult.invalid();
        }
        Instant now = clock.instant();
        var existing = sessionRepository.lockByTokenHash(hash(rawToken));
        if (existing.isEmpty()) {
            return RefreshResult.invalid();
        }
        var session = existing.get();
        if (session.revokedAt() != null) {
            sessionRepository.revokeFamily(session.familyId(), now);
            return RefreshResult.reuseDetected();
        }
        if (!session.expiresAt().isAfter(now)) {
            sessionRepository.revokeFamily(session.familyId(), now);
            return RefreshResult.invalid();
        }

        var tokenVersion =
                userRepository.tokenVersionForActiveMembership(
                        session.tenantId(), session.userId());
        var access =
                membershipRepository.findActiveAccess(
                        session.tenantId(), session.userId(), tokenVersion.orElse(-1));
        if (access.isEmpty()) {
            sessionRepository.revokeFamily(session.familyId(), now);
            return RefreshResult.invalid();
        }

        String replacementToken = randomToken();
        UUID replacementId = UUID.randomUUID();
        sessionRepository.revoke(session.id(), replacementId, now);
        sessionRepository.insert(
                replacementId,
                session.familyId(),
                session.tenantId(),
                session.userId(),
                hash(replacementToken),
                now,
                now.plus(lifetime));
        return RefreshResult.rotated(
                new IssuedRefreshToken(
                        replacementToken,
                        accessTokenService.issue(
                                session.userId(), session.tenantId(), tokenVersion.orElseThrow()),
                        accessTokenService.expiresInSeconds(),
                        lifetime,
                        session.userId(),
                        session.tenantId()));
    }

    @Transactional
    public void revokeFamilyFor(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        sessionRepository
                .lockByTokenHash(hash(rawToken))
                .ifPresent(
                        session ->
                                sessionRepository.revokeFamily(
                                        session.familyId(), clock.instant()));
    }

    private String randomToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String token) {
        try {
            byte[] digest =
                    MessageDigest.getInstance("SHA-256")
                            .digest(token.getBytes(StandardCharsets.US_ASCII));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static Duration requirePositiveLifetime(Duration value) {
        if (value == null || value.isZero() || value.isNegative()) {
            throw new IllegalArgumentException(
                    "security.jwt.refresh-token-ttl must be a positive duration");
        }
        return value;
    }

    public record IssuedRefreshToken(
            String refreshToken,
            String accessToken,
            long expiresIn,
            Duration refreshLifetime,
            long userId,
            java.util.UUID tenantId) {}

    public record RefreshResult(RefreshStatus status, IssuedRefreshToken tokens) {
        static RefreshResult invalid() {
            return new RefreshResult(RefreshStatus.INVALID, null);
        }

        static RefreshResult reuseDetected() {
            return new RefreshResult(RefreshStatus.REUSE_DETECTED, null);
        }

        static RefreshResult rotated(IssuedRefreshToken tokens) {
            return new RefreshResult(RefreshStatus.ROTATED, tokens);
        }
    }

    public enum RefreshStatus {
        ROTATED,
        INVALID,
        REUSE_DETECTED
    }

    public static class InvalidRefreshTokenException extends RuntimeException {}
}

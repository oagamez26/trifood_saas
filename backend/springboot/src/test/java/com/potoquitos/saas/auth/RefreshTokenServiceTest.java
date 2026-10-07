package com.potoquitos.saas.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {
    private static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");
    private static final UUID TENANT = UUID.fromString("2a7c42c7-88b1-4b19-a8b6-3408620e4218");
    private static final UUID SESSION = UUID.fromString("ce495b14-cdf6-4884-a7dc-aaab409411dd");
    private static final UUID FAMILY = UUID.fromString("1f728fa9-7cc6-4ce6-9ae6-283415582afc");

    @Mock private RefreshSessionRepository sessionRepository;
    @Mock private AuthenticationUserRepository userRepository;
    @Mock private TenantMembershipRepository membershipRepository;
    @Mock private AccessTokenService accessTokenService;

    private RefreshTokenService service;

    @BeforeEach
    void setUp() {
        service =
                new RefreshTokenService(
                        sessionRepository,
                        userRepository,
                        membershipRepository,
                        accessTokenService,
                        Clock.fixed(NOW, ZoneOffset.UTC),
                        Duration.ofDays(30));
    }

    @Test
    void validRefreshTokenIsRotatedAndOldSessionIsRevoked() {
        when(sessionRepository.lockByTokenHash(anyString()))
                .thenReturn(
                        Optional.of(
                                new RefreshSessionRepository.RefreshSession(
                                        SESSION, FAMILY, TENANT, 33, NOW.plusSeconds(600), null)));
        when(userRepository.tokenVersionForActiveMembership(TENANT, 33))
                .thenReturn(Optional.of(0));
        when(membershipRepository.findActiveAccess(TENANT, 33, 0))
                .thenReturn(Optional.of(new TenantMembershipAccess(Set.of(), Set.of())));
        when(accessTokenService.issue(eq(33L), eq(TENANT), eq(0))).thenReturn("new-access");
        when(accessTokenService.expiresInSeconds()).thenReturn(900L);

        var result = service.rotate("old-opaque-token");

        assertEquals(RefreshTokenService.RefreshStatus.ROTATED, result.status());
        assertEquals("new-access", result.tokens().accessToken());
        verify(sessionRepository).revoke(eq(SESSION), any(UUID.class), eq(NOW));
        verify(sessionRepository)
                .insert(
                        any(UUID.class),
                        eq(FAMILY),
                        eq(TENANT),
                        eq(33L),
                        anyString(),
                        eq(NOW),
                        eq(NOW.plus(Duration.ofDays(30))));
    }

    @Test
    void reusingRevokedTokenRevokesItsWholeFamily() {
        when(sessionRepository.lockByTokenHash(anyString()))
                .thenReturn(
                        Optional.of(
                                new RefreshSessionRepository.RefreshSession(
                                        SESSION, FAMILY, TENANT, 33, NOW.plusSeconds(600), NOW)));

        var result = service.rotate("replayed-token");

        assertEquals(RefreshTokenService.RefreshStatus.REUSE_DETECTED, result.status());
        verify(sessionRepository).revokeFamily(FAMILY, NOW);
        verify(sessionRepository, never())
                .insert(
                        any(UUID.class),
                        any(UUID.class),
                        any(UUID.class),
                        eq(33L),
                        anyString(),
                        any(Instant.class),
                        any(Instant.class));
    }

    @Test
    void expiredTokenIsRejectedAndItsFamilyRevoked() {
        when(sessionRepository.lockByTokenHash(anyString()))
                .thenReturn(
                        Optional.of(
                                new RefreshSessionRepository.RefreshSession(
                                        SESSION, FAMILY, TENANT, 33, NOW, null)));

        var result = service.rotate("expired-token");

        assertEquals(RefreshTokenService.RefreshStatus.INVALID, result.status());
        verify(sessionRepository).revokeFamily(FAMILY, NOW);
        verify(userRepository, never()).tokenVersionForActiveMembership(TENANT, 33);
    }
}

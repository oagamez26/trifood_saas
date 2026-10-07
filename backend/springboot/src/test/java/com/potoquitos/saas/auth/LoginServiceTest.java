package com.potoquitos.saas.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class LoginServiceTest {
    private static final UUID TENANT_A = UUID.fromString("2a7c42c7-88b1-4b19-a8b6-3408620e4218");

    @Mock private AuthenticationUserRepository userRepository;
    @Mock private TenantLoginRepository tenantLoginRepository;
    @Mock private TenantMembershipRepository membershipRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private RefreshTokenService refreshTokenService;
    @Mock private AccessTokenService accessTokenService;

    private LoginService service;

    @BeforeEach
    void setUp() {
        when(passwordEncoder.encode("constant-time-login-check")).thenReturn("dummy-hash");
        service =
                new LoginService(
                        userRepository,
                        tenantLoginRepository,
                        membershipRepository,
                        passwordEncoder,
                        refreshTokenService,
                        accessTokenService);
    }

    @Test
    void loginIssuesTokensOnlyAfterPasswordAndActiveMembershipValidation() {
        when(userRepository.findByUsername("alice"))
                .thenReturn(Optional.of(new AuthenticationUser(15, "password-hash", 0)));
        when(passwordEncoder.matches("correct-password", "password-hash")).thenReturn(true);
        when(tenantLoginRepository.findActiveMemberships(15))
                .thenReturn(List.of(new ActiveTenantMembership(TENANT_A, "tenant-a")));
        when(membershipRepository.findActiveAccess(TENANT_A, 15, 0))
                .thenReturn(Optional.of(new TenantMembershipAccess(Set.of("ADMIN"), Set.of())));
        var issued =
                new RefreshTokenService.IssuedRefreshToken(
                        "opaque-refresh", "signed-access", 900, Duration.ofDays(30), 15, TENANT_A);
        when(refreshTokenService.create(TENANT_A, 15)).thenReturn(issued);
        when(accessTokenService.expiresInSeconds()).thenReturn(900L);

        var result = service.login("Alice", "correct-password", null);

        assertEquals("signed-access", result.tokens().accessToken());
        assertEquals(15L, result.tokens().userId());
        verify(membershipRepository).findActiveAccess(TENANT_A, 15, 0);
    }

    @Test
    void wrongPasswordDoesNotResolveTenantOrIssueTokens() {
        when(userRepository.findByUsername("alice"))
                .thenReturn(Optional.of(new AuthenticationUser(15, "password-hash", 0)));
        when(passwordEncoder.matches("wrong-password", "password-hash")).thenReturn(false);

        assertThrows(
                BadCredentialsException.class,
                () -> service.login("alice", "wrong-password", null));

        verify(tenantLoginRepository, never()).findActiveMemberships(15);
        verify(refreshTokenService, never()).create(TENANT_A, 15);
    }

    @Test
    void userWithoutActiveMembershipGetsGenericInvalidCredentials() {
        when(userRepository.findByUsername("alice"))
                .thenReturn(Optional.of(new AuthenticationUser(15, "password-hash", 0)));
        when(passwordEncoder.matches("correct-password", "password-hash")).thenReturn(true);
        when(tenantLoginRepository.findActiveMemberships(15)).thenReturn(List.of());

        assertThrows(
                BadCredentialsException.class,
                () -> service.login("alice", "correct-password", null));

        verify(refreshTokenService, never()).create(TENANT_A, 15);
    }

    @Test
    void requestedTenantMustBeAnActiveMembershipOfTheAuthenticatedUser() {
        when(userRepository.findByUsername("alice"))
                .thenReturn(Optional.of(new AuthenticationUser(15, "password-hash", 0)));
        when(passwordEncoder.matches("correct-password", "password-hash")).thenReturn(true);
        when(tenantLoginRepository.findActiveMemberships(15))
                .thenReturn(List.of(new ActiveTenantMembership(TENANT_A, "tenant-a")));
        when(tenantLoginRepository.findActiveMembership(15, "tenant-b"))
                .thenReturn(Optional.empty());

        assertThrows(
                BadCredentialsException.class,
                () -> service.login("alice", "correct-password", "tenant-b"));

        verify(membershipRepository, never()).findActiveAccess(TENANT_A, 15, 0);
        verify(refreshTokenService, never()).create(TENANT_A, 15);
    }

    @Test
    void rejectsPasswordLongerThanTheBcryptInputLimit() {
        String overlongPassword = "a".repeat(73);
        when(userRepository.findByUsername("alice"))
                .thenReturn(Optional.of(new AuthenticationUser(15, "password-hash", 0)));
        when(passwordEncoder.matches(overlongPassword, "password-hash")).thenReturn(true);

        assertThrows(
                BadCredentialsException.class,
                () -> service.login("alice", overlongPassword, null));

        verify(tenantLoginRepository, never()).findActiveMemberships(15);
        verify(refreshTokenService, never()).create(TENANT_A, 15);
    }
}

package com.potoquitos.saas.auth;

import com.potoquitos.saas.shared.security.SaasPrincipal;
import java.util.List;
import java.util.Locale;
import java.nio.charset.StandardCharsets;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LoginService {
    private final AuthenticationUserRepository userRepository;
    private final TenantLoginRepository tenantLoginRepository;
    private final TenantMembershipRepository membershipRepository;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokenService;
    private final AccessTokenService accessTokenService;
    private final String dummyPasswordHash;

    public LoginService(
            AuthenticationUserRepository userRepository,
            TenantLoginRepository tenantLoginRepository,
            TenantMembershipRepository membershipRepository,
            PasswordEncoder passwordEncoder,
            RefreshTokenService refreshTokenService,
            AccessTokenService accessTokenService) {
        this.userRepository = userRepository;
        this.tenantLoginRepository = tenantLoginRepository;
        this.membershipRepository = membershipRepository;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokenService = refreshTokenService;
        this.accessTokenService = accessTokenService;
        this.dummyPasswordHash = passwordEncoder.encode("constant-time-login-check");
    }

    @Transactional
    public LoginResult login(String suppliedUsername, String password, String requestedTenantSlug) {
        String username = suppliedUsername.trim().toLowerCase(Locale.ROOT);
        var user = userRepository.findByUsername(username);
        boolean passwordMatches =
                user.isPresent()
                        && passwordEncoder.matches(password, user.get().passwordHash())
                        && password.getBytes(StandardCharsets.UTF_8).length <= 72;
        if (!passwordMatches) {
            if (user.isEmpty()) {
                passwordEncoder.matches(password, dummyPasswordHash);
            }
            throw new BadCredentialsException("Invalid username or password");
        }

        List<ActiveTenantMembership> memberships =
                tenantLoginRepository.findActiveMemberships(user.get().userId());
        if (memberships.isEmpty()) {
            throw new BadCredentialsException("Invalid username or password");
        }
        ActiveTenantMembership selected;
        if (requestedTenantSlug == null || requestedTenantSlug.isBlank()) {
            if (memberships.size() > 1) {
                throw new TenantSelectionRequiredException();
            }
            selected = memberships.getFirst();
        } else {
            selected =
                    tenantLoginRepository
                            .findActiveMembership(
                                    user.get().userId(),
                                    requestedTenantSlug.trim().toLowerCase(Locale.ROOT))
                            .orElseThrow(
                                    () ->
                                            new BadCredentialsException(
                                                    "Invalid username or password"));
        }

        var activeAccess =
                membershipRepository.findActiveAccess(
                        selected.tenantId(), user.get().userId(), user.get().tokenVersion());
        if (activeAccess.isEmpty()) {
            throw new BadCredentialsException("Invalid username or password");
        }

        var tokens =
                refreshTokenService.create(selected.tenantId(), user.get().userId());
        SaasPrincipal principal =
                new SaasPrincipal(
                        user.get().userId(),
                        selected.tenantId(),
                        user.get().tokenVersion(),
                        activeAccess.get().roles(),
                        activeAccess.get().permissions());
        return new LoginResult(
                tokens,
                principal,
                accessTokenService.expiresInSeconds());
    }

    public record LoginResult(
            RefreshTokenService.IssuedRefreshToken tokens,
            SaasPrincipal principal,
            long accessTokenExpiresIn) {}

    public static class TenantSelectionRequiredException extends RuntimeException {}
}

package com.potoquitos.saas.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.potoquitos.saas.shared.security.SaasPrincipal;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

class TenantMembershipAuthorizationFilterTests {
    private final TenantMembershipRepository membershipRepository =
            mock(TenantMembershipRepository.class);
    private final TenantMembershipAuthorizationFilter filter =
            new TenantMembershipAuthorizationFilter(membershipRepository);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void replacesTokenRoleClaimsWithActiveDatabaseMembershipAuthorities() throws Exception {
        UUID tenantId = UUID.randomUUID();
        SaasPrincipal tokenPrincipal =
                new SaasPrincipal(42, tenantId, Set.of("ADMINISTRADOR"), Set.of());
        Jwt jwt =
                Jwt.withTokenValue("signed")
                        .header("alg", "HS256")
                        .subject("42")
                        .claim("user_id", 42)
                        .claim("tenant_id", tenantId.toString())
                        .build();
        SecurityContextHolder.getContext()
                .setAuthentication(
                        UsernamePasswordAuthenticationToken.authenticated(
                                tokenPrincipal,
                                jwt,
                                List.of(new SimpleGrantedAuthority("ROLE_ADMINISTRADOR"))));
        when(membershipRepository.findActiveAccess(tenantId, 42))
                .thenReturn(
                        Optional.of(
                                new TenantMembershipAccess(
                                        Set.of("MESERO"), Set.of("orders.read"))));

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/auth/me");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);

        var authorization = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authorization.getPrincipal())
                .isEqualTo(
                        new SaasPrincipal(
                                42, tenantId, Set.of("MESERO"), Set.of("orders.read")));
        assertThat(authorization.getAuthorities())
                .extracting("authority")
                .containsExactlyInAnyOrder("ROLE_MESERO", "PERMISSION_orders.read");
    }

    @Test
    void rejectsTokensWithoutActiveMembershipForTheirTenant() throws Exception {
        UUID tenantId = UUID.randomUUID();
        SaasPrincipal principal = new SaasPrincipal(42, tenantId, Set.of(), Set.of());
        SecurityContextHolder.getContext()
                .setAuthentication(
                        UsernamePasswordAuthenticationToken.authenticated(
                                principal,
                                "signed",
                                List.of(new SimpleGrantedAuthority("ROLE_ADMINISTRADOR"))));
        when(membershipRepository.findActiveAccess(tenantId, 42))
                .thenReturn(Optional.empty());

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/auth/me");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(chain.getRequest()).isNull();
    }

    @Test
    void leavesUnauthenticatedRequestsForSpringSecurityToReject() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/auth/me");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isSameAs(request);
        verifyNoInteractions(membershipRepository);
    }
}

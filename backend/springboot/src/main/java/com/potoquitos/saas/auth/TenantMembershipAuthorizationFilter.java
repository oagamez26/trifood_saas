package com.potoquitos.saas.auth;

import com.potoquitos.saas.shared.security.SaasPrincipal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class TenantMembershipAuthorizationFilter extends OncePerRequestFilter {
    private final TenantMembershipRepository membershipRepository;

    public TenantMembershipAuthorizationFilter(TenantMembershipRepository membershipRepository) {
        this.membershipRepository = membershipRepository;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof SaasPrincipal principal) {
            var access =
                    membershipRepository.findActiveAccess(
                            principal.tenantId(), principal.userId(), principal.tokenVersion());
            if (access.isEmpty()) {
                response.sendError(HttpServletResponse.SC_FORBIDDEN);
                return;
            }

            TenantMembershipAccess membership = access.get();
            SaasPrincipal authorizedPrincipal =
                    new SaasPrincipal(
                            principal.userId(),
                            principal.tenantId(),
                            principal.tokenVersion(),
                            membership.roles(),
                            membership.permissions());
            List<SimpleGrantedAuthority> authorities = new ArrayList<>();
            membership.roles().stream()
                    .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                    .forEach(authorities::add);
            membership.permissions().stream()
                    .map(permission -> new SimpleGrantedAuthority("PERMISSION_" + permission))
                    .forEach(authorities::add);

            UsernamePasswordAuthenticationToken authorizedAuthentication =
                    UsernamePasswordAuthenticationToken.authenticated(
                            authorizedPrincipal, null, authorities);
            authorizedAuthentication.setDetails(authentication.getDetails());
            SecurityContextHolder.getContext().setAuthentication(authorizedAuthentication);
        }

        filterChain.doFilter(request, response);
    }
}

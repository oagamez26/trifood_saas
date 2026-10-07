package com.potoquitos.saas.shared.tenant;

import com.potoquitos.saas.shared.security.SaasPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Component
public class TenantContextInterceptor implements HandlerInterceptor {
    private final TenantContext tenantContext;

    public TenantContextInterceptor(TenantContext tenantContext) {
        this.tenantContext = tenantContext;
    }

    @Override
    public boolean preHandle(
            HttpServletRequest request, HttpServletResponse response, Object handler) {
        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof SaasPrincipal principal)) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "Authenticated tenant context is required");
        }
        tenantContext.initialize(principal);
        return true;
    }
}

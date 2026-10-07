package com.potoquitos.saas.shared.tenant;

import com.potoquitos.saas.shared.security.SaasPrincipal;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.annotation.ScopedProxyMode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.context.annotation.RequestScope;
import org.springframework.web.server.ResponseStatusException;

@Component
@RequestScope(proxyMode = ScopedProxyMode.TARGET_CLASS)
public class TenantContext {
    private Long userId;
    private UUID tenantId;
    private Set<String> roles = Set.of();
    private Set<String> permissions = Set.of();

    public void initialize(SaasPrincipal principal) {
        if (userId != null) {
            throw new IllegalStateException("Tenant context has already been initialized");
        }
        userId = principal.userId();
        tenantId = principal.tenantId();
        roles = principal.roles();
        permissions = principal.permissions();
    }

    public UUID requireTenantId() {
        if (tenantId == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "Authenticated tenant context is required");
        }
        return tenantId;
    }

    public long requireUserId() {
        if (userId == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "Authenticated user context is required");
        }
        return userId;
    }

    public Set<String> requireRoles() {
        requireTenantId();
        return roles;
    }

    public Set<String> requirePermissions() {
        requireTenantId();
        return permissions;
    }
}

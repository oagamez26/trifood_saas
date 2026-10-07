package com.potoquitos.saas.shared.security;

import java.util.Set;
import java.util.UUID;

public record SaasPrincipal(
        long userId, UUID tenantId, Set<String> roles, Set<String> permissions) {
    public SaasPrincipal(long userId, UUID tenantId, Set<String> roles) {
        this(userId, tenantId, roles, Set.of());
    }

    public SaasPrincipal {
        if (userId <= 0) {
            throw new IllegalArgumentException("userId must be positive");
        }
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId is required");
        }
        roles = Set.copyOf(roles);
        permissions = Set.copyOf(permissions);
    }
}

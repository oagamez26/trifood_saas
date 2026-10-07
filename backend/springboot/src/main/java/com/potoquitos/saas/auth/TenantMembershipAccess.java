package com.potoquitos.saas.auth;

import java.util.Set;

public record TenantMembershipAccess(Set<String> roles, Set<String> permissions) {
    public TenantMembershipAccess {
        roles = Set.copyOf(roles);
        permissions = Set.copyOf(permissions);
    }
}

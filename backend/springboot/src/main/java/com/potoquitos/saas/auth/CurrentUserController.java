package com.potoquitos.saas.auth;

import com.potoquitos.saas.shared.tenant.TenantContext;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class CurrentUserController {
    private final TenantContext tenantContext;

    public CurrentUserController(TenantContext tenantContext) {
        this.tenantContext = tenantContext;
    }

    @GetMapping("/me")
    public CurrentUserResponse currentUser() {
        return new CurrentUserResponse(
                tenantContext.requireUserId(),
                tenantContext.requireTenantId(),
                tenantContext.requireRoles(),
                tenantContext.requirePermissions());
    }

    public record CurrentUserResponse(
            long userId, UUID tenantId, Set<String> roles, Set<String> permissions) {}
}

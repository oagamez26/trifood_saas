package com.potoquitos.saas.shared.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.potoquitos.saas.shared.security.SaasPrincipal;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class TenantContextTests {
    @Test
    void exposesIdentityAndEffectiveTenantAuthorities() {
        TenantContext context = new TenantContext();
        UUID tenantId = UUID.randomUUID();
        context.initialize(
                new SaasPrincipal(51, tenantId, Set.of("MESERO"), Set.of("orders.read")));

        assertThat(context.requireUserId()).isEqualTo(51);
        assertThat(context.requireTenantId()).isEqualTo(tenantId);
        assertThat(context.requireRoles()).containsExactly("MESERO");
        assertThat(context.requirePermissions()).containsExactly("orders.read");
    }

    @Test
    void refusesToProvideTenantBeforeAuthenticationInitializesContext() {
        TenantContext context = new TenantContext();

        assertThatThrownBy(context::requireTenantId)
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Authenticated tenant context is required");
        assertThatThrownBy(context::requireUserId)
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Authenticated user context is required");
    }

    @Test
    void cannotReplaceAnInitializedTenant() {
        TenantContext context = new TenantContext();
        context.initialize(new SaasPrincipal(51, UUID.randomUUID(), Set.of(), Set.of()));

        assertThatThrownBy(
                        () ->
                                context.initialize(
                                        new SaasPrincipal(
                                                52, UUID.randomUUID(), Set.of(), Set.of())))
                .isInstanceOf(IllegalStateException.class);
    }
}

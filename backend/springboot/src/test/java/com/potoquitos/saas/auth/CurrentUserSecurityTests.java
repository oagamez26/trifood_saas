package com.potoquitos.saas.auth;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.potoquitos.saas.catalog.CatalogCategoryController;
import com.potoquitos.saas.catalog.CatalogCategoryService;
import com.potoquitos.saas.shared.security.SaasPrincipal;
import com.potoquitos.saas.shared.tenant.TenantContext;
import com.potoquitos.saas.shared.tenant.TenantContextInterceptor;
import com.potoquitos.saas.shared.tenant.TenantWebConfiguration;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@WebMvcTest({CurrentUserController.class, CatalogCategoryController.class})
@TestPropertySource(properties = "security.jwt.secret=0123456789abcdef0123456789abcdef")
@Import({
    SecurityConfiguration.class,
    SaasJwtAuthenticationConverter.class,
    TenantMembershipAuthorizationFilter.class,
    TenantContext.class,
    TenantContextInterceptor.class,
    TenantWebConfiguration.class
})
class CurrentUserSecurityTests {
    @Autowired private MockMvc mockMvc;

    @MockitoBean private TenantMembershipRepository membershipRepository;

    @MockitoBean private CatalogCategoryService categoryService;

    @Test
    void protectedCurrentUserEndpointRejectsMissingAuthentication() throws Exception {
        mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void resolvesTenantAndAuthoritiesFromAuthenticationAndMembership() throws Exception {
        UUID tenantId = UUID.randomUUID();
        mockActiveMembership(tenantId, 42);

        mockMvc.perform(authenticatedRequest(tenantId).header("X-Tenant-Id", UUID.randomUUID()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(42))
                .andExpect(jsonPath("$.tenantId").value(tenantId.toString()))
                .andExpect(jsonPath("$.roles[0]").value("MESERO"))
                .andExpect(jsonPath("$.permissions[0]").value("orders.read"));
    }

    @Test
    void rejectsAuthenticatedUsersWithoutActiveTenantMembership() throws Exception {
        UUID tenantId = UUID.randomUUID();
        when(membershipRepository.findActiveAccess(tenantId, 42)).thenReturn(Optional.empty());

        mockMvc.perform(authenticatedRequest(tenantId)).andExpect(status().isForbidden());
    }

    @Test
    void endpointPermissionCannotBeGrantedByTokenRoleAlone() throws Exception {
        UUID tenantId = UUID.randomUUID();
        mockActiveMembership(tenantId, 42);

        mockMvc.perform(authenticatedRequest("/api/catalog/categories", tenantId))
                .andExpect(status().isForbidden());
    }

    @Test
    void endpointPermissionFromTheTenantRoleGrantsAccess() throws Exception {
        UUID tenantId = UUID.randomUUID();
        when(membershipRepository.findActiveAccess(tenantId, 42))
                .thenReturn(
                        Optional.of(
                                new TenantMembershipAccess(
                                        Set.of("MESERO"),
                                        Set.of("catalog.categories.read"))));
        when(categoryService.findAllForCurrentTenant()).thenReturn(List.of());

        mockMvc.perform(authenticatedRequest("/api/catalog/categories", tenantId))
                .andExpect(status().isOk());
    }

    private MockHttpServletRequestBuilder authenticatedRequest(UUID tenantId) {
        return authenticatedRequest("/api/auth/me", tenantId);
    }

    private MockHttpServletRequestBuilder authenticatedRequest(String path, UUID tenantId) {
        var authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        new SaasPrincipal(42, tenantId, Set.of("FORGED"), Set.of()),
                        "signed-token",
                        List.of(new SimpleGrantedAuthority("ROLE_FORGED")));
        return get(path).with(authentication(authentication));
    }

    private void mockActiveMembership(UUID tenantId, long userId) {
        when(membershipRepository.findActiveAccess(tenantId, userId))
                .thenReturn(
                        Optional.of(
                                new TenantMembershipAccess(
                                        Set.of("MESERO"), Set.of("orders.read"))));
    }
}

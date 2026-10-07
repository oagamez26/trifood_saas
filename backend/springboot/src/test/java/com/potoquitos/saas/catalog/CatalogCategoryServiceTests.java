package com.potoquitos.saas.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.potoquitos.saas.shared.security.SaasPrincipal;
import com.potoquitos.saas.shared.tenant.TenantContext;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CatalogCategoryServiceTests {
    private final CatalogCategoryRepository repository = mock(CatalogCategoryRepository.class);

    @Test
    void usesAuthenticatedTenantForListAndIdLookups() {
        UUID authenticatedTenant = UUID.randomUUID();
        TenantContext context = new TenantContext();
        context.initialize(new SaasPrincipal(42, authenticatedTenant, Set.of(), Set.of()));
        CatalogCategoryService service = new CatalogCategoryService(repository, context);
        when(repository.findAllByTenantId(authenticatedTenant)).thenReturn(List.of());
        when(repository.findByIdAndTenantId(73, authenticatedTenant)).thenReturn(Optional.empty());

        assertThat(service.findAllForCurrentTenant()).isEmpty();
        assertThat(service.findByIdForCurrentTenant(73)).isEmpty();

        verify(repository).findAllByTenantId(authenticatedTenant);
        verify(repository).findByIdAndTenantId(73, authenticatedTenant);
    }
}

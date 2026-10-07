package com.potoquitos.saas.catalog;

import com.potoquitos.saas.shared.tenant.TenantContext;
import java.util.List;
import java.util.Optional;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

@Service
public class CatalogCategoryService {
    private final CatalogCategoryRepository categoryRepository;
    private final TenantContext tenantContext;

    public CatalogCategoryService(
            CatalogCategoryRepository categoryRepository, TenantContext tenantContext) {
        this.categoryRepository = categoryRepository;
        this.tenantContext = tenantContext;
    }

    @PreAuthorize("hasAuthority('PERMISSION_catalog.categories.read')")
    public List<CatalogCategory> findAllForCurrentTenant() {
        return categoryRepository.findAllByTenantId(tenantContext.requireTenantId());
    }

    @PreAuthorize("hasAuthority('PERMISSION_catalog.categories.read')")
    public Optional<CatalogCategory> findByIdForCurrentTenant(Integer id) {
        return categoryRepository.findByIdAndTenantId(id, tenantContext.requireTenantId());
    }
}

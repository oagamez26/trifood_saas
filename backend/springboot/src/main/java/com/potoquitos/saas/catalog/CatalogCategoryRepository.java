package com.potoquitos.saas.catalog;

import com.potoquitos.saas.shared.tenant.TenantScopedRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CatalogCategoryRepository
        extends TenantScopedRepository<CatalogCategory, Integer> {}

package com.potoquitos.saas.shared.tenant;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.NoRepositoryBean;
import org.springframework.data.repository.Repository;

@NoRepositoryBean
public interface TenantScopedRepository<T, ID> extends Repository<T, ID> {
    List<T> findAllByTenantId(UUID tenantId);

    Optional<T> findByIdAndTenantId(ID id, UUID tenantId);
}

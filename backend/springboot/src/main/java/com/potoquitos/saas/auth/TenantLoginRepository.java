package com.potoquitos.saas.auth;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class TenantLoginRepository {
    private final JdbcTemplate jdbcTemplate;

    public TenantLoginRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<ActiveTenantMembership> findActiveMemberships(long userId) {
        return jdbcTemplate.query(
                """
                SELECT t.id, t.slug
                FROM tenant_memberships tm
                JOIN tenants t ON t.id = tm.tenant_id
                WHERE tm.user_id = ?
                  AND tm.status = 'ACTIVE'
                  AND t.status = 'ACTIVE'
                ORDER BY t.slug
                """,
                (resultSet, rowNumber) ->
                        new ActiveTenantMembership(
                                resultSet.getObject("id", UUID.class),
                                resultSet.getString("slug")),
                userId);
    }

    public Optional<ActiveTenantMembership> findActiveMembership(
            long userId, String tenantSlug) {
        return jdbcTemplate
                .query(
                        """
                        SELECT t.id, t.slug
                        FROM tenant_memberships tm
                        JOIN tenants t ON t.id = tm.tenant_id
                        WHERE tm.user_id = ?
                          AND t.slug = ?
                          AND tm.status = 'ACTIVE'
                          AND t.status = 'ACTIVE'
                        """,
                        (resultSet, rowNumber) ->
                                new ActiveTenantMembership(
                                        resultSet.getObject("id", UUID.class),
                                        resultSet.getString("slug")),
                        userId,
                        tenantSlug)
                .stream()
                .findFirst();
    }
}

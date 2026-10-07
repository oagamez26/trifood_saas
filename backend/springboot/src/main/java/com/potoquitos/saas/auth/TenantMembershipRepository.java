package com.potoquitos.saas.auth;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class TenantMembershipRepository {
    private static final String ACTIVE_MEMBERSHIP_AUTHORITIES =
            """
            SELECT r.name AS role_name, p.codename AS permission_codename
            FROM tenant_memberships tm
            JOIN tenants t ON t.id = tm.tenant_id
            JOIN users u ON u.id = tm.user_id
            LEFT JOIN user_roles ur
                ON ur.tenant_id = tm.tenant_id AND ur.user_id = tm.user_id
            LEFT JOIN roles r
                ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
            LEFT JOIN role_permissions rp
                ON rp.tenant_id = r.tenant_id AND rp.role_id = r.id
            LEFT JOIN permissions p ON p.id = rp.permission_id
            WHERE tm.tenant_id = ?
              AND tm.user_id = ?
              AND u.token_version = ?
              AND tm.status = 'ACTIVE'
              AND t.status = 'ACTIVE'
              AND u.is_active IS TRUE
            """;

    private final JdbcTemplate jdbcTemplate;

    public TenantMembershipRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<TenantMembershipAccess> findActiveAccess(UUID tenantId, long userId) {
        return findActiveAccess(tenantId, userId, 0);
    }

    public Optional<TenantMembershipAccess> findActiveAccess(
            UUID tenantId, long userId, int tokenVersion) {
        List<AuthorityRow> rows =
                jdbcTemplate.query(
                        ACTIVE_MEMBERSHIP_AUTHORITIES,
                        (resultSet, rowNumber) ->
                                new AuthorityRow(
                                        resultSet.getString("role_name"),
                                        resultSet.getString("permission_codename")),
                        tenantId,
                        userId,
                        tokenVersion);
        if (rows.isEmpty()) {
            return Optional.empty();
        }

        SetBuilder access = new SetBuilder();
        rows.forEach(access::add);
        return Optional.of(new TenantMembershipAccess(access.roles, access.permissions));
    }

    private record AuthorityRow(String roleName, String permissionCodename) {}

    private static final class SetBuilder {
        private final LinkedHashSet<String> roles = new LinkedHashSet<>();
        private final LinkedHashSet<String> permissions = new LinkedHashSet<>();

        private void add(AuthorityRow row) {
            if (row.roleName() != null) {
                roles.add(row.roleName());
            }
            if (row.permissionCodename() != null) {
                permissions.add(row.permissionCodename());
            }
        }
    }
}

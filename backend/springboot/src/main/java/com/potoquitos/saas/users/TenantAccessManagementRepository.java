package com.potoquitos.saas.users;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class TenantAccessManagementRepository {
    private final JdbcTemplate jdbcTemplate;

    public TenantAccessManagementRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<TenantUserView> findUsers(UUID tenantId) {
        return jdbcTemplate.query(
                """
                SELECT u.id, u.username, u.email,
                       COALESCE(tm.display_first_name, u.first_name) AS first_name,
                       COALESCE(tm.display_last_name, u.last_name) AS last_name,
                       u.is_active AS user_active, tm.status AS membership_status,
                       COALESCE(string_agg(r.name, ',' ORDER BY r.name), '') AS role_names
                FROM tenant_memberships tm
                JOIN users u ON u.id = tm.user_id
                LEFT JOIN user_roles ur
                    ON ur.tenant_id = tm.tenant_id AND ur.user_id = tm.user_id
                LEFT JOIN roles r
                    ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
                WHERE tm.tenant_id = ?
                GROUP BY u.id, tm.display_first_name, tm.display_last_name, tm.status
                ORDER BY u.id
                """,
                (resultSet, rowNumber) ->
                        new TenantUserView(
                                resultSet.getLong("id"),
                                resultSet.getString("username"),
                                resultSet.getString("email"),
                                resultSet.getString("first_name"),
                                resultSet.getString("last_name"),
                                resultSet.getBoolean("user_active"),
                                resultSet.getString("membership_status"),
                                roleNames(resultSet.getString("role_names"))),
                tenantId);
    }

    public Optional<TenantUserView> findUser(UUID tenantId, long userId) {
        return jdbcTemplate
                .query(
                        """
                        SELECT u.id, u.username, u.email,
                               COALESCE(tm.display_first_name, u.first_name) AS first_name,
                               COALESCE(tm.display_last_name, u.last_name) AS last_name,
                               u.is_active AS user_active, tm.status AS membership_status,
                               COALESCE(string_agg(r.name, ',' ORDER BY r.name), '') AS role_names
                        FROM tenant_memberships tm
                        JOIN users u ON u.id = tm.user_id
                        LEFT JOIN user_roles ur
                            ON ur.tenant_id = tm.tenant_id AND ur.user_id = tm.user_id
                        LEFT JOIN roles r
                            ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
                        WHERE tm.tenant_id = ? AND tm.user_id = ?
                        GROUP BY u.id, tm.display_first_name, tm.display_last_name, tm.status
                        """,
                        (resultSet, rowNumber) ->
                                new TenantUserView(
                                        resultSet.getLong("id"),
                                        resultSet.getString("username"),
                                        resultSet.getString("email"),
                                        resultSet.getString("first_name"),
                                        resultSet.getString("last_name"),
                                        resultSet.getBoolean("user_active"),
                                        resultSet.getString("membership_status"),
                                        roleNames(resultSet.getString("role_names"))),
                        tenantId,
                        userId)
                .stream()
                .findFirst();
    }

    public Optional<Long> findUserIdByEmail(String email) {
        return jdbcTemplate
                .query(
                        "SELECT id FROM users WHERE lower(email) = ?",
                        (resultSet, rowNumber) -> resultSet.getLong(1),
                        email.trim().toLowerCase(Locale.ROOT))
                .stream()
                .findFirst();
    }

    public boolean isActiveUser(long userId) {
        return Boolean.TRUE.equals(
                jdbcTemplate.queryForObject(
                        "SELECT is_active FROM users WHERE id = ?",
                        Boolean.class,
                        userId));
    }

    public long createUser(
            UUID tenantId,
            String username,
            String email,
            String passwordHash,
            String firstName,
            String lastName) {
        Long userId =
                jdbcTemplate.queryForObject(
                        """
                        INSERT INTO users
                            (username, email, first_name, last_name, password_hash, is_active,
                             must_change_password, token_version, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, TRUE, FALSE, 0, CURRENT_TIMESTAMP,
                                CURRENT_TIMESTAMP)
                        RETURNING id
                        """,
                        Long.class,
                        username,
                        email,
                        firstName,
                        lastName,
                        passwordHash);
        jdbcTemplate.update(
                """
                INSERT INTO tenant_memberships
                    (tenant_id, user_id, display_first_name, display_last_name)
                VALUES (?, ?, ?, ?)
                """,
                tenantId,
                userId,
                firstName,
                lastName);
        return userId;
    }

    public void addMembership(
            UUID tenantId, long userId, String firstName, String lastName) {
        jdbcTemplate.update(
                """
                INSERT INTO tenant_memberships
                    (tenant_id, user_id, display_first_name, display_last_name)
                VALUES (?, ?, ?, ?)
                """,
                tenantId,
                userId,
                firstName,
                lastName);
    }

    public int updateMembershipProfile(
            UUID tenantId,
            long userId,
            String firstName,
            String lastName,
            Boolean active) {
        return jdbcTemplate.update(
                """
                UPDATE tenant_memberships tm
                SET display_first_name = COALESCE(?, tm.display_first_name, u.first_name),
                    display_last_name = COALESCE(?, tm.display_last_name, u.last_name),
                    status = CASE WHEN ?::boolean IS NULL THEN tm.status
                                  WHEN ? IS TRUE THEN 'ACTIVE'
                                  ELSE 'SUSPENDED' END,
                    updated_at = CURRENT_TIMESTAMP
                FROM users u
                WHERE tm.user_id = u.id
                  AND tm.tenant_id = ?
                  AND tm.user_id = ?
                """,
                firstName,
                lastName,
                active,
                active,
                tenantId,
                userId);
    }

    public int revokeMembership(UUID tenantId, long userId) {
        return jdbcTemplate.update(
                """
                UPDATE tenant_memberships
                SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP
                WHERE tenant_id = ? AND user_id = ? AND status <> 'REVOKED'
                """,
                tenantId,
                userId);
    }

    public void lockTenantForAccessChange(UUID tenantId) {
        jdbcTemplate.queryForObject(
                "SELECT id FROM tenants WHERE id = ? FOR UPDATE", UUID.class, tenantId);
    }

    public boolean isActiveRoleManager(UUID tenantId, long userId) {
        return Boolean.TRUE.equals(
                jdbcTemplate.queryForObject(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM tenant_memberships tm
                            JOIN tenants t ON t.id = tm.tenant_id
                            JOIN users u ON u.id = tm.user_id
                            JOIN user_roles ur
                                ON ur.tenant_id = tm.tenant_id AND ur.user_id = tm.user_id
                            JOIN role_permissions rp
                                ON rp.tenant_id = ur.tenant_id AND rp.role_id = ur.role_id
                            JOIN permissions p ON p.id = rp.permission_id
                            WHERE tm.tenant_id = ? AND tm.user_id = ?
                              AND tm.status = 'ACTIVE' AND t.status = 'ACTIVE'
                              AND u.is_active IS TRUE AND p.codename = 'roles.manage'
                        )
                        """,
                        Boolean.class,
                        tenantId,
                        userId));
    }

    public long countActiveRoleManagersExcludingUser(UUID tenantId, long userId) {
        return jdbcTemplate.queryForObject(
                """
                SELECT count(DISTINCT tm.user_id)
                FROM tenant_memberships tm
                JOIN tenants t ON t.id = tm.tenant_id
                JOIN users u ON u.id = tm.user_id
                JOIN user_roles ur
                    ON ur.tenant_id = tm.tenant_id AND ur.user_id = tm.user_id
                JOIN role_permissions rp
                    ON rp.tenant_id = ur.tenant_id AND rp.role_id = ur.role_id
                JOIN permissions p ON p.id = rp.permission_id
                WHERE tm.tenant_id = ? AND tm.user_id <> ?
                  AND tm.status = 'ACTIVE' AND t.status = 'ACTIVE'
                  AND u.is_active IS TRUE AND p.codename = 'roles.manage'
                """,
                Long.class,
                tenantId,
                userId);
    }

    public boolean isActiveRoleManagerThroughRole(UUID tenantId, long roleId) {
        return Boolean.TRUE.equals(
                jdbcTemplate.queryForObject(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM tenant_memberships tm
                            JOIN tenants t ON t.id = tm.tenant_id
                            JOIN users u ON u.id = tm.user_id
                            JOIN user_roles ur
                                ON ur.tenant_id = tm.tenant_id AND ur.user_id = tm.user_id
                            JOIN role_permissions rp
                                ON rp.tenant_id = ur.tenant_id AND rp.role_id = ur.role_id
                            JOIN permissions p ON p.id = rp.permission_id
                            WHERE tm.tenant_id = ? AND ur.role_id = ?
                              AND tm.status = 'ACTIVE' AND t.status = 'ACTIVE'
                              AND u.is_active IS TRUE AND p.codename = 'roles.manage'
                        )
                        """,
                        Boolean.class,
                        tenantId,
                        roleId));
    }

    public long countActiveRoleManagersExcludingRole(UUID tenantId, long roleId) {
        return jdbcTemplate.queryForObject(
                """
                SELECT count(DISTINCT tm.user_id)
                FROM tenant_memberships tm
                JOIN tenants t ON t.id = tm.tenant_id
                JOIN users u ON u.id = tm.user_id
                JOIN user_roles ur
                    ON ur.tenant_id = tm.tenant_id AND ur.user_id = tm.user_id
                JOIN role_permissions rp
                    ON rp.tenant_id = ur.tenant_id AND rp.role_id = ur.role_id
                JOIN permissions p ON p.id = rp.permission_id
                WHERE tm.tenant_id = ? AND ur.role_id <> ?
                  AND tm.status = 'ACTIVE' AND t.status = 'ACTIVE'
                  AND u.is_active IS TRUE AND p.codename = 'roles.manage'
                """,
                Long.class,
                tenantId,
                roleId);
    }

    public boolean isActiveRoleManagerOnlyThroughRole(
            UUID tenantId, long userId, long roleId) {
        return Boolean.TRUE.equals(
                jdbcTemplate.queryForObject(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM tenant_memberships tm
                            JOIN tenants t ON t.id = tm.tenant_id
                            JOIN users u ON u.id = tm.user_id
                            JOIN user_roles ur
                                ON ur.tenant_id = tm.tenant_id AND ur.user_id = tm.user_id
                            JOIN role_permissions rp
                                ON rp.tenant_id = ur.tenant_id AND rp.role_id = ur.role_id
                            JOIN permissions p ON p.id = rp.permission_id
                            WHERE tm.tenant_id = ? AND tm.user_id = ? AND ur.role_id = ?
                              AND tm.status = 'ACTIVE' AND t.status = 'ACTIVE'
                              AND u.is_active IS TRUE AND p.codename = 'roles.manage'
                              AND NOT EXISTS (
                                  SELECT 1
                                  FROM user_roles other_ur
                                  JOIN role_permissions other_rp
                                      ON other_rp.tenant_id = other_ur.tenant_id
                                     AND other_rp.role_id = other_ur.role_id
                                  JOIN permissions other_p
                                      ON other_p.id = other_rp.permission_id
                                  WHERE other_ur.tenant_id = tm.tenant_id
                                    AND other_ur.user_id = tm.user_id
                                    AND other_ur.role_id <> ur.role_id
                                    AND other_p.codename = 'roles.manage'
                              )
                        )
                        """,
                        Boolean.class,
                        tenantId,
                        userId,
                        roleId));
    }

    public List<TenantRoleView> findRoles(UUID tenantId) {
        return jdbcTemplate.query(
                """
                SELECT r.id, r.name, r.description,
                       COALESCE(string_agg(p.codename, ',' ORDER BY p.codename), '') AS permissions
                FROM roles r
                LEFT JOIN role_permissions rp
                    ON rp.tenant_id = r.tenant_id AND rp.role_id = r.id
                LEFT JOIN permissions p ON p.id = rp.permission_id
                WHERE r.tenant_id = ?
                GROUP BY r.id
                ORDER BY r.name
                """,
                (resultSet, rowNumber) ->
                        new TenantRoleView(
                                resultSet.getLong("id"),
                                resultSet.getString("name"),
                                resultSet.getString("description"),
                                roleNames(resultSet.getString("permissions"))),
                tenantId);
    }

    public List<PermissionView> findPermissions() {
        return jdbcTemplate.query(
                """
                SELECT id, codename, description
                FROM permissions
                ORDER BY codename
                """,
                (resultSet, rowNumber) ->
                        new PermissionView(
                                resultSet.getLong("id"),
                                resultSet.getString("codename"),
                                resultSet.getString("description")));
    }

    public long createRole(UUID tenantId, String name, String description) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO roles (tenant_id, name, description, created_at, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
                """,
                Long.class,
                tenantId,
                name,
                description);
    }

    public boolean roleExists(UUID tenantId, long roleId) {
        return Boolean.TRUE.equals(
                jdbcTemplate.queryForObject(
                        "SELECT EXISTS (SELECT 1 FROM roles WHERE tenant_id = ? AND id = ?)",
                        Boolean.class,
                        tenantId,
                        roleId));
    }

    public boolean userMembershipExists(UUID tenantId, long userId) {
        return Boolean.TRUE.equals(
                jdbcTemplate.queryForObject(
                        """
                        SELECT EXISTS (
                            SELECT 1 FROM tenant_memberships
                            WHERE tenant_id = ? AND user_id = ?
                        )
                        """,
                        Boolean.class,
                        tenantId,
                        userId));
    }

    public List<Long> permissionIds(List<String> codenames) {
        if (codenames.isEmpty()) {
            return List.of();
        }
        String placeholders = String.join(",", java.util.Collections.nCopies(codenames.size(), "?"));
        return jdbcTemplate.query(
                "SELECT id FROM permissions WHERE codename IN (" + placeholders + ")",
                (resultSet, rowNumber) -> resultSet.getLong(1),
                codenames.toArray());
    }

    public int removeRolePermissions(UUID tenantId, long roleId) {
        return jdbcTemplate.update(
                "DELETE FROM role_permissions WHERE tenant_id = ? AND role_id = ?",
                tenantId,
                roleId);
    }

    public void addRolePermission(UUID tenantId, long roleId, long permissionId) {
        jdbcTemplate.update(
                """
                INSERT INTO role_permissions (tenant_id, role_id, permission_id, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """,
                tenantId,
                roleId,
                permissionId);
    }

    public void assignRole(UUID tenantId, long userId, long roleId) {
        jdbcTemplate.update(
                """
                INSERT INTO user_roles (tenant_id, user_id, role_id, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (tenant_id, user_id, role_id) DO NOTHING
                """,
                tenantId,
                userId,
                roleId);
    }

    public int revokeRole(UUID tenantId, long userId, long roleId) {
        return jdbcTemplate.update(
                "DELETE FROM user_roles WHERE tenant_id = ? AND user_id = ? AND role_id = ?",
                tenantId,
                userId,
                roleId);
    }

    private static List<String> roleNames(String value) {
        return value == null || value.isEmpty() ? List.of() : List.of(value.split(","));
    }

    public record TenantUserView(
            long userId,
            String username,
            String email,
            String firstName,
            String lastName,
            boolean userActive,
            String membershipStatus,
            List<String> roles) {}

    public record TenantRoleView(
            long roleId, String name, String description, List<String> permissions) {}

    public record PermissionView(long permissionId, String codename, String description) {}
}

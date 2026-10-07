package com.potoquitos.saas.users;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TenantBootstrapService {
    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;

    public TenantBootstrapService(JdbcTemplate jdbcTemplate, PasswordEncoder passwordEncoder) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public void createInitialTenant(
            String tenantSlug,
            String tenantName,
            String username,
            String email,
            String password,
            String firstName,
            String lastName) {
        if (password.getBytes(StandardCharsets.UTF_8).length < 12
                || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException(
                    "Bootstrap password must contain 12 to 72 UTF-8 bytes");
        }
        jdbcTemplate.execute("LOCK TABLE tenants IN EXCLUSIVE MODE");
        Integer tenantCount = jdbcTemplate.queryForObject("SELECT count(*) FROM tenants", Integer.class);
        Integer userCount = jdbcTemplate.queryForObject("SELECT count(*) FROM users", Integer.class);
        if (tenantCount == null || userCount == null || tenantCount != 0 || userCount != 0) {
            throw new IllegalStateException(
                    "Bootstrap is one-time only and requires an empty tenants/users schema");
        }

        UUID tenantId = UUID.randomUUID();
        jdbcTemplate.update(
                """
                INSERT INTO tenants (id, slug, display_name, status)
                VALUES (?, ?, ?, 'ACTIVE')
                """,
                tenantId,
                tenantSlug.trim().toLowerCase(Locale.ROOT),
                tenantName.trim());
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
                        username.trim().toLowerCase(Locale.ROOT),
                        email.trim().toLowerCase(Locale.ROOT),
                        firstName.trim(),
                        lastName.trim(),
                        passwordEncoder.encode(password));
        Long adminRoleId =
                jdbcTemplate.queryForObject(
                        """
                        INSERT INTO roles
                            (tenant_id, name, description, created_at, updated_at)
                        VALUES (?, 'TENANT_ADMIN', 'Initial tenant administrator',
                                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        RETURNING id
                        """,
                        Long.class,
                        tenantId);
        jdbcTemplate.update(
                """
                INSERT INTO tenant_memberships
                    (tenant_id, user_id, display_first_name, display_last_name)
                VALUES (?, ?, ?, ?)
                """,
                tenantId,
                userId,
                firstName.trim(),
                lastName.trim());
        int expectedPermissionCount =
                jdbcTemplate.queryForObject(
                        """
                        SELECT count(*)
                        FROM permissions
                        WHERE codename IN (
                            'users.read', 'users.create', 'users.update',
                            'users.memberships.manage', 'users.roles.assign',
                            'roles.read', 'roles.manage'
                        )
                        """,
                        Integer.class);
        if (expectedPermissionCount != 7) {
            throw new IllegalStateException(
                    "Required identity permissions are missing; verify Flyway V3 was applied");
        }
        jdbcTemplate.update(
                """
                INSERT INTO user_roles (tenant_id, user_id, role_id, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """,
                tenantId,
                userId,
                adminRoleId);
        jdbcTemplate.update(
                """
                INSERT INTO role_permissions (tenant_id, role_id, permission_id, created_at)
                SELECT ?, ?, p.id, CURRENT_TIMESTAMP
                FROM permissions p
                """,
                tenantId,
                adminRoleId);
    }
}

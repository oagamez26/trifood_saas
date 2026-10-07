package com.potoquitos.saas.auth;

import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AuthenticationUserRepository {
    private final JdbcTemplate jdbcTemplate;

    public AuthenticationUserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<AuthenticationUser> findByUsername(String username) {
        return jdbcTemplate.query(
                """
                        SELECT id, password_hash, token_version
                        FROM users
                        WHERE username = ? AND is_active IS TRUE
                        """,
                (resultSet, rowNumber) ->
                        new AuthenticationUser(
                                resultSet.getLong("id"),
                                resultSet.getString("password_hash"),
                                resultSet.getInt("token_version")),
                username).stream().findFirst();
    }

    public Optional<Integer> tokenVersionForActiveMembership(UUID tenantId, long userId) {
        return jdbcTemplate
                .query(
                        """
                        SELECT u.token_version
                        FROM users u
                        JOIN tenant_memberships tm ON tm.user_id = u.id
                        JOIN tenants t ON t.id = tm.tenant_id
                        WHERE u.id = ?
                          AND tm.tenant_id = ?
                          AND u.is_active IS TRUE
                          AND tm.status = 'ACTIVE'
                          AND t.status = 'ACTIVE'
                        """,
                        (resultSet, rowNumber) -> resultSet.getInt(1),
                        userId,
                        tenantId)
                .stream()
                .findFirst();
    }
}

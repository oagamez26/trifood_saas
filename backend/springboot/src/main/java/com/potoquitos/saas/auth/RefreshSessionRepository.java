package com.potoquitos.saas.auth;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class RefreshSessionRepository {
    private static final RowMapper<RefreshSession> SESSION_ROW_MAPPER =
            (resultSet, rowNumber) ->
                    new RefreshSession(
                            resultSet.getObject("id", UUID.class),
                            resultSet.getObject("family_id", UUID.class),
                            resultSet.getObject("tenant_id", UUID.class),
                            resultSet.getLong("user_id"),
                            resultSet.getTimestamp("expires_at").toInstant(),
                            resultSet.getTimestamp("revoked_at") == null
                                    ? null
                                    : resultSet.getTimestamp("revoked_at").toInstant());

    private final JdbcTemplate jdbcTemplate;

    public RefreshSessionRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void insert(
            UUID id,
            UUID familyId,
            UUID tenantId,
            long userId,
            String tokenHash,
            Instant issuedAt,
            Instant expiresAt) {
        jdbcTemplate.update(
                """
                INSERT INTO refresh_sessions
                    (id, family_id, tenant_id, user_id, token_hash, issued_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                id,
                familyId,
                tenantId,
                userId,
                tokenHash,
                Timestamp.from(issuedAt),
                Timestamp.from(expiresAt));
    }

    public Optional<RefreshSession> lockByTokenHash(String tokenHash) {
        return jdbcTemplate
                .query(
                        """
                        SELECT id, family_id, tenant_id, user_id, expires_at, revoked_at
                        FROM refresh_sessions
                        WHERE token_hash = ?
                        FOR UPDATE
                        """,
                        SESSION_ROW_MAPPER,
                        tokenHash)
                .stream()
                .findFirst();
    }

    public void revoke(UUID sessionId, UUID replacementId, Instant revokedAt) {
        jdbcTemplate.update(
                """
                UPDATE refresh_sessions
                SET revoked_at = ?, replaced_by_session_id = ?
                WHERE id = ? AND revoked_at IS NULL
                """,
                Timestamp.from(revokedAt),
                replacementId,
                sessionId);
    }

    public void revokeFamily(UUID familyId, Instant revokedAt) {
        jdbcTemplate.update(
                """
                UPDATE refresh_sessions
                SET revoked_at = ?
                WHERE family_id = ? AND revoked_at IS NULL
                """,
                Timestamp.from(revokedAt),
                familyId);
    }

    public record RefreshSession(
            UUID id,
            UUID familyId,
            UUID tenantId,
            long userId,
            Instant expiresAt,
            Instant revokedAt) {}
}

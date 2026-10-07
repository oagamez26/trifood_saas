package com.potoquitos.saas;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import javax.crypto.spec.SecretKeySpec;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class SaasApiApplicationTests {
    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16.15-alpine")
                    .withDatabaseName("saas_test")
                    .withUsername("saas_test")
                    .withPassword(UUID.randomUUID().toString());
    private static final String TEST_JWT_SECRET = UUID.randomUUID().toString();

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.flyway.enabled", () -> true);
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        registry.add("security.jwt.secret", () -> TEST_JWT_SECRET);
    }

    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private Flyway flyway;
    @Autowired private TestRestTemplate restTemplate;

    @Test
    void springContextStarts() {
        assertThat(jdbcTemplate).isNotNull();
    }

    @Test
    void connectsToPostgres() {
        assertThat(jdbcTemplate.queryForObject("SELECT 1", Integer.class)).isEqualTo(1);
    }

    @Test
    void flywayAppliesCompleteTenantSchema() {
        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("2");
        assertThat(
                        jdbcTemplate.queryForObject(
                                """
                                SELECT count(*)
                                FROM information_schema.tables
                                WHERE table_schema = 'public'
                                  AND table_type = 'BASE TABLE'
                                  AND table_name <> 'flyway_schema_history'
                                """,
                                Integer.class))
                .isEqualTo(34);
        assertThat(
                        jdbcTemplate.queryForObject(
                                """
                                SELECT count(*)
                                FROM information_schema.columns
                                WHERE table_schema = 'public'
                                  AND column_name = 'tenant_id'
                                  AND is_nullable = 'NO'
                                """,
                                Integer.class))
                .isEqualTo(30);
        assertThat(
                        jdbcTemplate.queryForObject(
                                """
                                SELECT count(*)
                                FROM pg_constraint
                                WHERE conrelid = 'public.catalog_products'::regclass
                                  AND contype = 'f'
                                  AND pg_get_constraintdef(oid) LIKE
                                      'FOREIGN KEY (tenant_id, category_id)%'
                                """,
                                Integer.class))
                .isEqualTo(1);
    }

    @Test
    void tenantScopedCategoryNamesCanRepeatButCrossTenantProductReferencesAreRejected() {
        UUID tenantA = UUID.randomUUID();
        UUID tenantB = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO tenants (id, slug, display_name, status) VALUES (?, ?, ?, 'ACTIVE')",
                tenantA,
                "test-" + tenantA,
                "Test A");
        jdbcTemplate.update(
                "INSERT INTO tenants (id, slug, display_name, status) VALUES (?, ?, ?, 'ACTIVE')",
                tenantB,
                "test-" + tenantB,
                "Test B");

        jdbcTemplate.update(
                """
                INSERT INTO catalog_categories
                    (id, tenant_id, name, is_active, display_order, created_at, updated_at)
                VALUES (101, ?, 'Bebidas', TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                       (102, ?, 'Bebidas', TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                tenantA,
                tenantB);

        assertThatThrownBy(
                        () ->
                                jdbcTemplate.update(
                                        """
                                        INSERT INTO catalog_products
                                            (id, tenant_id, internal_code, name, description,
                                             current_price, currency, price_version, category_id,
                                             is_active, is_available, created_at, updated_at)
                                        VALUES (201, ?, 'TEST-201', 'Producto', '', 1000, 'COP',
                                                1, 101, TRUE, TRUE, CURRENT_TIMESTAMP,
                                                CURRENT_TIMESTAMP)
                                        """,
                                        tenantB))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void protectedCurrentUserEndpointRejectsMissingBearerToken() {
        var response = restTemplate.getForEntity("/api/auth/me", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void currentUserUsesActiveDatabaseMembershipInsteadOfTokenOrFrontendTenantClaims() {
        TestIdentity identity = createIdentity("MESERO", "catalog.categories.read");
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt(identity, List.of("ADMINISTRADOR", "FORGED")));
        headers.set("X-Tenant-Id", UUID.randomUUID().toString());

        var response =
                restTemplate.exchange(
                        "/api/auth/me",
                        HttpMethod.GET,
                        new HttpEntity<>(headers),
                        String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .contains("\"userId\":" + identity.userId())
                .contains("\"tenantId\":\"" + identity.tenantId() + "\"")
                .contains("\"roles\":[\"MESERO\"]")
                .contains("\"permissions\":[\"catalog.categories.read\"]")
                .doesNotContain("FORGED")
                .doesNotContain("ADMINISTRADOR");
    }

    @Test
    void rejectsAnActiveUserWhenTokenSelectsATenantWithoutMembership() {
        TestIdentity identity = createIdentity("MESERO", "catalog.categories.read");
        UUID otherTenant = createTenant();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(
                jwt(new TestIdentity(identity.userId(), otherTenant), List.of("ADMINISTRADOR")));

        var response =
                restTemplate.exchange(
                        "/api/auth/me",
                        HttpMethod.GET,
                        new HttpEntity<>(headers),
                        String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void categoryReadsArePermissionProtectedAndScopedToTheAuthenticatedTenant() {
        TestIdentity tenantA = createIdentity("MESERO", "catalog.categories.read");
        TestIdentity tenantB = createIdentity("ADMINISTRADOR", "catalog.categories.read");
        insertCategory(tenantA.tenantId(), "Only Tenant A");
        insertCategory(tenantB.tenantId(), "Only Tenant B");
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt(tenantA, List.of("ADMINISTRADOR")));
        headers.set("X-Tenant-Id", tenantB.tenantId().toString());

        var response =
                restTemplate.exchange(
                        "/api/catalog/categories",
                        HttpMethod.GET,
                        new HttpEntity<>(headers),
                        String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .contains("Only Tenant A")
                .doesNotContain("Only Tenant B");
    }

    @Test
    void tokenRoleAloneCannotAuthorizeCategoryReads() {
        TestIdentity identity = createIdentity("MESERO", null);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt(identity, List.of("ADMINISTRADOR")));

        var response =
                restTemplate.exchange(
                        "/api/catalog/categories",
                        HttpMethod.GET,
                        new HttpEntity<>(headers),
                        String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void actuatorHealthReportsDatabaseAndApplication() {
        var response = restTemplate.getForEntity("/actuator/health", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"status\":\"UP\"");
    }

    private TestIdentity createIdentity(String roleName, String permissionCodename) {
        UUID tenantId = createTenant();
        Integer userId =
                jdbcTemplate.queryForObject(
                        """
                        INSERT INTO users
                            (username, email, first_name, last_name, password_hash, is_active,
                             must_change_password, token_version, created_at, updated_at)
                        VALUES (?, ?, 'Integration', 'Test', '$2a$test-hash', TRUE,
                                FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        RETURNING id
                        """,
                        Integer.class,
                        "user-" + UUID.randomUUID(),
                        UUID.randomUUID() + "@example.invalid");
        jdbcTemplate.update(
                "INSERT INTO tenant_memberships (tenant_id, user_id) VALUES (?, ?)",
                tenantId,
                userId);
        if (roleName != null) {
            Integer roleId =
                    jdbcTemplate.queryForObject(
                            """
                            INSERT INTO roles (tenant_id, name, created_at, updated_at)
                            VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                            RETURNING id
                            """,
                            Integer.class,
                            tenantId,
                            roleName);
            jdbcTemplate.update(
                    "INSERT INTO user_roles (tenant_id, user_id, role_id) VALUES (?, ?, ?)",
                    tenantId,
                    userId,
                    roleId);
            if (permissionCodename != null) {
                Integer permissionId =
                        jdbcTemplate.queryForObject(
                                """
                                INSERT INTO permissions (codename, created_at)
                                VALUES (?, CURRENT_TIMESTAMP)
                                ON CONFLICT (codename) DO UPDATE SET codename = EXCLUDED.codename
                                RETURNING id
                                """,
                                Integer.class,
                                permissionCodename);
                jdbcTemplate.update(
                        """
                        INSERT INTO role_permissions (tenant_id, role_id, permission_id)
                        VALUES (?, ?, ?)
                        """,
                        tenantId,
                        roleId,
                        permissionId);
            }
        }
        return new TestIdentity(userId, tenantId);
    }

    private UUID createTenant() {
        UUID tenantId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO tenants (id, slug, display_name, status) VALUES (?, ?, ?, 'ACTIVE')",
                tenantId,
                "test-" + tenantId,
                "Integration Test");
        return tenantId;
    }

    private void insertCategory(UUID tenantId, String name) {
        jdbcTemplate.update(
                """
                INSERT INTO catalog_categories
                    (tenant_id, name, is_active, display_order, created_at, updated_at)
                VALUES (?, ?, TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                tenantId,
                name);
    }

    private static String jwt(TestIdentity identity, List<String> tokenRoles) {
        var key =
                new SecretKeySpec(
                        TEST_JWT_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        var encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
        Instant issuedAt = Instant.now();
        JwtClaimsSet claims =
                JwtClaimsSet.builder()
                        .subject(Long.toString(identity.userId()))
                        .issuedAt(issuedAt)
                        .expiresAt(issuedAt.plusSeconds(300))
                        .claim("user_id", identity.userId())
                        .claim("tenant_id", identity.tenantId().toString())
                        .claim("roles", tokenRoles)
                        .build();
        return encoder.encode(
                        JwtEncoderParameters.from(
                                JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
    }

    private record TestIdentity(long userId, UUID tenantId) {}
}

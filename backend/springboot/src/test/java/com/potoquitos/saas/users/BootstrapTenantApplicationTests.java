package com.potoquitos.saas.users;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class BootstrapTenantApplicationTests {
    @Test
    void bootstrapRefusesTheLegacyPotoquitosDatabase() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        BootstrapTenantApplication.ensureNotLegacyDatabase(
                                "jdbc:postgresql://localhost:5432/potoquitos"));
    }

    @Test
    void bootstrapAcceptsAnIsolatedSaasDatabase() {
        assertDoesNotThrow(
                () ->
                        BootstrapTenantApplication.ensureNotLegacyDatabase(
                                "jdbc:postgresql://localhost:5432/trifood_v2_validation"));
    }
}

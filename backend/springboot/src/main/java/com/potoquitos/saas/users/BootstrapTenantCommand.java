package com.potoquitos.saas.users;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("bootstrap")
public class BootstrapTenantCommand implements CommandLineRunner {
    private final TenantBootstrapService bootstrapService;
    private final ConfigurableApplicationContext applicationContext;
    private final String tenantSlug;
    private final String tenantName;
    private final String username;
    private final String email;
    private final String password;
    private final String firstName;
    private final String lastName;

    public BootstrapTenantCommand(
            TenantBootstrapService bootstrapService,
            ConfigurableApplicationContext applicationContext,
            @Value("${TRIFOOD_BOOTSTRAP_TENANT_SLUG:}") String tenantSlug,
            @Value("${TRIFOOD_BOOTSTRAP_TENANT_NAME:}") String tenantName,
            @Value("${TRIFOOD_BOOTSTRAP_USERNAME:}") String username,
            @Value("${TRIFOOD_BOOTSTRAP_EMAIL:}") String email,
            @Value("${TRIFOOD_BOOTSTRAP_PASSWORD:}") String password,
            @Value("${TRIFOOD_BOOTSTRAP_FIRST_NAME:}") String firstName,
            @Value("${TRIFOOD_BOOTSTRAP_LAST_NAME:}") String lastName) {
        this.bootstrapService = bootstrapService;
        this.applicationContext = applicationContext;
        this.tenantSlug = required("TRIFOOD_BOOTSTRAP_TENANT_SLUG", tenantSlug);
        this.tenantName = required("TRIFOOD_BOOTSTRAP_TENANT_NAME", tenantName);
        this.username = required("TRIFOOD_BOOTSTRAP_USERNAME", username);
        this.email = required("TRIFOOD_BOOTSTRAP_EMAIL", email);
        this.password = required("TRIFOOD_BOOTSTRAP_PASSWORD", password);
        this.firstName = required("TRIFOOD_BOOTSTRAP_FIRST_NAME", firstName);
        this.lastName = required("TRIFOOD_BOOTSTRAP_LAST_NAME", lastName);
    }

    @Override
    public void run(String... args) {
        bootstrapService.createInitialTenant(
                tenantSlug, tenantName, username, email, password, firstName, lastName);
        System.out.println("Initial tenant and administrator were created successfully.");
        applicationContext.close();
    }

    private static String required(String name, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " must be configured for bootstrap");
        }
        return value;
    }
}

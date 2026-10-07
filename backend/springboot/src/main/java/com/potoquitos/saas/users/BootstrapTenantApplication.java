package com.potoquitos.saas.users;

import com.potoquitos.saas.SaasApiApplication;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import org.springframework.boot.SpringApplication;

public final class BootstrapTenantApplication {
    private BootstrapTenantApplication() {}

    public static void main(String[] args) {
        ensureBootstrapInputs();
        SpringApplication application = new SpringApplication(SaasApiApplication.class);
        application.addInitializers(
                context ->
                        ensureNotLegacyDatabase(
                                context.getEnvironment()
                                        .getProperty("spring.datasource.url", "")));
        String[] bootstrapArgs = Arrays.copyOf(args, args.length + 3);
        bootstrapArgs[args.length] = "--spring.profiles.active=bootstrap";
        bootstrapArgs[args.length + 1] = "--spring.flyway.enabled=true";
        bootstrapArgs[args.length + 2] = "--server.port=0";
        application.run(bootstrapArgs);
    }

    private static void ensureBootstrapInputs() {
        for (String name :
                new String[] {
                    "TRIFOOD_BOOTSTRAP_TENANT_SLUG",
                    "TRIFOOD_BOOTSTRAP_TENANT_NAME",
                    "TRIFOOD_BOOTSTRAP_USERNAME",
                    "TRIFOOD_BOOTSTRAP_EMAIL",
                    "TRIFOOD_BOOTSTRAP_PASSWORD",
                    "TRIFOOD_BOOTSTRAP_FIRST_NAME",
                    "TRIFOOD_BOOTSTRAP_LAST_NAME"
                }) {
            if (System.getenv().getOrDefault(name, "").isBlank()) {
                throw new IllegalArgumentException(name + " must be configured for bootstrap");
            }
        }
        int passwordBytes =
                System.getenv()
                        .get("TRIFOOD_BOOTSTRAP_PASSWORD")
                        .getBytes(StandardCharsets.UTF_8)
                        .length;
        if (passwordBytes < 12 || passwordBytes > 72) {
            throw new IllegalArgumentException(
                    "Bootstrap password must contain 12 to 72 UTF-8 bytes");
        }
    }

    static void ensureNotLegacyDatabase(String jdbcUrl) {
        String prefix = "jdbc:postgresql://";
        if (!jdbcUrl.startsWith(prefix)) {
            throw new IllegalArgumentException(
                    "Bootstrap requires an explicit PostgreSQL URL with a database name");
        }
        String[] pathParts = jdbcUrl.substring(prefix.length()).split("/", 2);
        String database =
                pathParts.length == 2 ? pathParts[1].split("[?;]", 2)[0] : "";
        if (database.isBlank() || database.toLowerCase(Locale.ROOT).equals("potoquitos")) {
            throw new IllegalArgumentException(
                    "Bootstrap requires a SaaS database and refuses the legacy potoquitos database");
        }
    }
}

package com.potoquitos.saas.auth;

import java.nio.charset.StandardCharsets;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableMethodSecurity
public class SecurityConfiguration {
    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            SaasJwtAuthenticationConverter jwtAuthenticationConverter,
            TenantMembershipAuthorizationFilter tenantMembershipAuthorizationFilter)
            throws Exception {
        return http.cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(
                        session ->
                                session.sessionCreationPolicy(
                                        SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(
                        authorize ->
                                authorize
                                        .requestMatchers(
                                                "/actuator/health",
                                                "/v3/api-docs/**",
                                                "/swagger-ui/**",
                                                "/swagger-ui.html")
                                        .permitAll()
                                        .requestMatchers(
                                                HttpMethod.POST,
                                                "/api/auth/login",
                                                "/api/auth/refresh",
                                                "/api/auth/logout")
                                        .permitAll()
                                        .requestMatchers(HttpMethod.OPTIONS, "/**")
                                        .permitAll()
                                        .anyRequest()
                                        .authenticated())
                .oauth2ResourceServer(
                        oauth2 ->
                                oauth2.jwt(
                                        jwt ->
                                                jwt.jwtAuthenticationConverter(
                                                        jwtAuthenticationConverter)))
                .addFilterAfter(
                        tenantMembershipAuthorizationFilter,
                        BearerTokenAuthenticationFilter.class)
                .build();
    }

    @Bean
    FilterRegistrationBean<TenantMembershipAuthorizationFilter>
            tenantMembershipFilterServletRegistration(
                    TenantMembershipAuthorizationFilter tenantMembershipAuthorizationFilter) {
        FilterRegistrationBean<TenantMembershipAuthorizationFilter> registration =
                new FilterRegistrationBean<>(tenantMembershipAuthorizationFilter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    JwtDecoder jwtDecoder(@Value("${security.jwt.secret:}") String secret) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "JWT_SECRET must contain at least 32 UTF-8 bytes");
        }
        SecretKey key = new SecretKeySpec(keyBytes, "HmacSHA256");
        NimbusJwtDecoder decoder =
                NimbusJwtDecoder.withSecretKey(key)
                        .macAlgorithm(MacAlgorithm.HS256)
                        .build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer("trifood"));
        return decoder;
    }

    @Bean
    JwtEncoder jwtEncoder(@Value("${security.jwt.secret:}") String secret) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "JWT_SECRET must contain at least 32 UTF-8 bytes");
        }
        SecretKey key = new SecretKeySpec(keyBytes, "HmacSHA256");
        return new NimbusJwtEncoder(new com.nimbusds.jose.jwk.source.ImmutableSecret<>(key));
    }

    @Bean
    Clock systemClock() {
        return Clock.systemUTC();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins}") List<String> allowedOrigins) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(
                List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(
                List.of("Authorization", "Content-Type", "X-CSRF-TOKEN"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}

package com.potoquitos.saas.shared.tenant;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class TenantWebConfiguration implements WebMvcConfigurer {
    private final TenantContextInterceptor tenantContextInterceptor;

    public TenantWebConfiguration(TenantContextInterceptor tenantContextInterceptor) {
        this.tenantContextInterceptor = tenantContextInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(tenantContextInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        "/api/auth/login", "/api/auth/refresh", "/api/auth/logout");
    }
}

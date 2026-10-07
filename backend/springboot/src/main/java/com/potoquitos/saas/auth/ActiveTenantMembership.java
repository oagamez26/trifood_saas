package com.potoquitos.saas.auth;

import java.util.UUID;

public record ActiveTenantMembership(UUID tenantId, String slug) {}

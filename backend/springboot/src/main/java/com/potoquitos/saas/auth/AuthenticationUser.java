package com.potoquitos.saas.auth;

public record AuthenticationUser(long userId, String passwordHash, int tokenVersion) {}

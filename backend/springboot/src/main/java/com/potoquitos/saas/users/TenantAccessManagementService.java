package com.potoquitos.saas.users;

import com.potoquitos.saas.users.TenantAccessManagementRepository.PermissionView;
import com.potoquitos.saas.users.TenantAccessManagementRepository.TenantRoleView;
import com.potoquitos.saas.users.TenantAccessManagementRepository.TenantUserView;
import com.potoquitos.saas.shared.tenant.TenantContext;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TenantAccessManagementService {
    private final TenantAccessManagementRepository repository;
    private final TenantContext tenantContext;
    private final PasswordEncoder passwordEncoder;

    public TenantAccessManagementService(
            TenantAccessManagementRepository repository,
            TenantContext tenantContext,
            PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.tenantContext = tenantContext;
        this.passwordEncoder = passwordEncoder;
    }

    public List<TenantUserView> listUsers() {
        return repository.findUsers(tenantContext.requireTenantId());
    }

    public TenantUserView getUser(long userId) {
        return requireUser(userId);
    }

    @Transactional
    public TenantUserView createUser(CreateUserRequest request) {
        String password = request.password();
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Password must not exceed 72 UTF-8 bytes");
        }
        String username = request.username().trim().toLowerCase(Locale.ROOT);
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String firstName = request.firstName().trim();
        String lastName = request.lastName().trim();
        if (username.length() < 3 || email.isBlank() || firstName.isBlank() || lastName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid user profile");
        }
        long userId =
                repository.createUser(
                        tenantContext.requireTenantId(),
                        username,
                        email,
                        passwordEncoder.encode(password),
                        firstName,
                        lastName);
        return requireUser(userId);
    }

    @Transactional
    public TenantUserView addMembership(AddMembershipRequest request) {
        var userId =
                repository
                        .findUserIdByEmail(request.email())
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NOT_FOUND, "User not found"));
        if (!repository.isActiveUser(userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User is inactive");
        }
        repository.addMembership(
                tenantContext.requireTenantId(),
                userId,
                blankToNull(request.firstName()),
                blankToNull(request.lastName()));
        return requireUser(userId);
    }

    @Transactional
    public TenantUserView updateMembership(long userId, UpdateMembershipRequest request) {
        if (request.firstName() == null && request.lastName() == null && request.active() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "At least one membership field must be provided");
        }
        var tenantId = tenantContext.requireTenantId();
        if (Boolean.FALSE.equals(request.active())) {
            repository.lockTenantForAccessChange(tenantId);
            ensureAnotherAdministratorRemains(
                    tenantId, repository.isActiveRoleManager(tenantId, userId), userId);
        }
        int updated =
                repository.updateMembershipProfile(
                        tenantId,
                        userId,
                        blankToNull(request.firstName()),
                        blankToNull(request.lastName()),
                        request.active());
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant membership not found");
        }
        return requireUser(userId);
    }

    @Transactional
    public void revokeMembership(long userId) {
        var tenantId = tenantContext.requireTenantId();
        repository.lockTenantForAccessChange(tenantId);
        ensureAnotherAdministratorRemains(
                tenantId, repository.isActiveRoleManager(tenantId, userId), userId);
        if (repository.revokeMembership(tenantId, userId) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant membership not found");
        }
    }

    public List<TenantRoleView> listRoles() {
        return repository.findRoles(tenantContext.requireTenantId());
    }

    public List<PermissionView> listPermissions() {
        return repository.findPermissions();
    }

    @Transactional
    public TenantRoleView createRole(CreateRoleRequest request) {
        String name = request.name().trim();
        if (name.length() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role name");
        }
        long roleId =
                repository.createRole(
                        tenantContext.requireTenantId(), name, blankToNull(request.description()));
        return repository.findRoles(tenantContext.requireTenantId()).stream()
                .filter(role -> role.roleId() == roleId)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Created role could not be reloaded"));
    }

    @Transactional
    public TenantRoleView replaceRolePermissions(
            long roleId, ReplaceRolePermissionsRequest request) {
        var tenantId = tenantContext.requireTenantId();
        requireRole(tenantId, roleId);
        List<String> codenames =
                request.permissionCodenames().stream().map(String::trim).distinct().toList();
        if (codenames.size() != request.permissionCodenames().size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duplicate permission");
        }
        List<Long> permissionIds = repository.permissionIds(codenames);
        if (permissionIds.size() != codenames.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown permission");
        }
        if (!codenames.contains("roles.manage")) {
            repository.lockTenantForAccessChange(tenantId);
            boolean removesActiveAdmin =
                    repository.isActiveRoleManagerThroughRole(tenantId, roleId);
            if (removesActiveAdmin
                    && repository.countActiveRoleManagersExcludingRole(tenantId, roleId) == 0L) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "The tenant must retain an active user with roles.manage");
            }
        }
        repository.removeRolePermissions(tenantId, roleId);
        permissionIds.forEach(
                permissionId -> repository.addRolePermission(tenantId, roleId, permissionId));
        return repository.findRoles(tenantId).stream()
                .filter(role -> role.roleId() == roleId)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Updated role could not be reloaded"));
    }

    @Transactional
    public void assignRole(long userId, long roleId) {
        var tenantId = tenantContext.requireTenantId();
        requireMembership(tenantId, userId);
        requireRole(tenantId, roleId);
        repository.assignRole(tenantId, userId, roleId);
    }

    @Transactional
    public void revokeRole(long userId, long roleId) {
        var tenantId = tenantContext.requireTenantId();
        requireMembership(tenantId, userId);
        requireRole(tenantId, roleId);
        repository.lockTenantForAccessChange(tenantId);
        boolean removesLastAdministrator =
                repository.isActiveRoleManagerOnlyThroughRole(tenantId, userId, roleId)
                        && repository.countActiveRoleManagersExcludingUser(tenantId, userId) == 0L;
        if (removesLastAdministrator) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "The tenant must retain an active user with roles.manage");
        }
        if (repository.revokeRole(tenantId, userId, roleId) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Role assignment not found");
        }
    }

    private TenantUserView requireUser(long userId) {
        return repository
                .findUser(tenantContext.requireTenantId(), userId)
                .orElseThrow(
                        () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private void requireMembership(java.util.UUID tenantId, long userId) {
        if (!repository.userMembershipExists(tenantId, userId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Tenant membership not found");
        }
    }

    private void requireRole(java.util.UUID tenantId, long roleId) {
        if (!repository.roleExists(tenantId, roleId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found");
        }
    }

    private void ensureAnotherAdministratorRemains(
            java.util.UUID tenantId, boolean currentUserIsAdministrator, long userId) {
        if (currentUserIsAdministrator
                && repository.countActiveRoleManagersExcludingUser(tenantId, userId) == 0L) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "The tenant must retain an active user with roles.manage");
        }
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record CreateUserRequest(
            @jakarta.validation.constraints.NotBlank
                    @jakarta.validation.constraints.Pattern(regexp = "[A-Za-z0-9._-]{3,80}")
                    String username,
            @jakarta.validation.constraints.NotBlank
                    @jakarta.validation.constraints.Email
                    @jakarta.validation.constraints.Size(max = 255)
                    String email,
            @jakarta.validation.constraints.NotBlank
                    @jakarta.validation.constraints.Size(min = 12, max = 128)
                    String password,
            @jakarta.validation.constraints.NotBlank
                    @jakarta.validation.constraints.Size(max = 100)
                    String firstName,
            @jakarta.validation.constraints.NotBlank
                    @jakarta.validation.constraints.Size(max = 100)
                    String lastName) {}

    public record AddMembershipRequest(
            @jakarta.validation.constraints.NotBlank
                    @jakarta.validation.constraints.Email
                    @jakarta.validation.constraints.Size(max = 255)
                    String email,
            @jakarta.validation.constraints.Size(max = 100) String firstName,
            @jakarta.validation.constraints.Size(max = 100) String lastName) {}

    public record UpdateMembershipRequest(
            @jakarta.validation.constraints.Size(max = 100) String firstName,
            @jakarta.validation.constraints.Size(max = 100) String lastName,
            Boolean active) {}

    public record CreateRoleRequest(
            @jakarta.validation.constraints.NotBlank
                    @jakarta.validation.constraints.Pattern(regexp = "[A-Za-z0-9._ -]{2,80}")
                    String name,
            @jakarta.validation.constraints.Size(max = 255) String description) {}

    public record ReplaceRolePermissionsRequest(
            @jakarta.validation.constraints.NotNull
                    @jakarta.validation.constraints.Size(max = 200)
                    List<
                                    @jakarta.validation.constraints.NotBlank
                                            @jakarta.validation.constraints.Size(max = 120)
                                            String>
                            permissionCodenames) {}
}

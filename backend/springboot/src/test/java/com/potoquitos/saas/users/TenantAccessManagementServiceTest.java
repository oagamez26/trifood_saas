package com.potoquitos.saas.users;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.potoquitos.saas.shared.security.SaasPrincipal;
import com.potoquitos.saas.shared.tenant.TenantContext;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class TenantAccessManagementServiceTest {
    private static final UUID TENANT_A = UUID.fromString("2a7c42c7-88b1-4b19-a8b6-3408620e4218");
    private static final UUID TENANT_B = UUID.fromString("79ab6e89-333e-492a-9e21-251c3a835077");

    @Mock private TenantAccessManagementRepository repository;

    private TenantContext tenantContext;
    private BCryptPasswordEncoder passwordEncoder;
    private TenantAccessManagementService service;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.initialize(
                new SaasPrincipal(81L, TENANT_A, 0, java.util.Set.of(), java.util.Set.of()));
        passwordEncoder = new BCryptPasswordEncoder(4);
        service = new TenantAccessManagementService(repository, tenantContext, passwordEncoder);
    }

    @Test
    void createUserStoresOnlyPasswordHashAndCreatesMembershipInAuthenticatedTenant() {
        var request =
                new TenantAccessManagementService.CreateUserRequest(
                        "new.user", "new@example.test", "a-strong-password-1", "New", "User");
        when(repository.createUser(
                        eq(TENANT_A),
                        eq("new.user"),
                        eq("new@example.test"),
                        anyString(),
                        eq("New"),
                        eq("User")))
                .thenReturn(100L);
        when(repository.findUser(TENANT_A, 100L))
                .thenReturn(
                        Optional.of(
                                new TenantAccessManagementRepository.TenantUserView(
                                        100,
                                        "new.user",
                                        "new@example.test",
                                        "New",
                                        "User",
                                        true,
                                        "ACTIVE",
                                        List.of())));

        var created = service.createUser(request);

        ArgumentCaptor<String> passwordHash = ArgumentCaptor.forClass(String.class);
        verify(repository)
                .createUser(
                        eq(TENANT_A),
                        eq("new.user"),
                        eq("new@example.test"),
                        passwordHash.capture(),
                        eq("New"),
                        eq("User"));
        assertNotEquals(request.password(), passwordHash.getValue());
        org.junit.jupiter.api.Assertions.assertTrue(
                passwordEncoder.matches(request.password(), passwordHash.getValue()));
        assertEquals(100L, created.userId());
    }

    @Test
    void cannotReadUserThroughMembershipInAnotherTenant() {
        when(repository.findUser(TENANT_A, 400L)).thenReturn(Optional.empty());

        ResponseStatusException exception =
                assertThrows(ResponseStatusException.class, () -> service.getUser(400L));

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        verify(repository).findUser(TENANT_A, 400L);
        verify(repository, never()).findUser(eq(TENANT_B), eq(400L));
    }

    @Test
    void cannotAssignRoleThatIsNotOwnedByAuthenticatedTenant() {
        when(repository.userMembershipExists(TENANT_A, 400L)).thenReturn(true);
        when(repository.roleExists(TENANT_A, 90L)).thenReturn(false);

        ResponseStatusException exception =
                assertThrows(ResponseStatusException.class, () -> service.assignRole(400L, 90L));

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        verify(repository, never()).assignRole(TENANT_A, 400L, 90L);
    }

    @Test
    void membershipUpdatesUseAuthenticatedTenantAndDoNotChangeGlobalUser() {
        when(repository.updateMembershipProfile(
                        TENANT_A, 400L, "Tenant A Name", null, true))
                .thenReturn(1);
        when(repository.findUser(TENANT_A, 400L))
                .thenReturn(
                        Optional.of(
                                new TenantAccessManagementRepository.TenantUserView(
                                        400,
                                        "shared.user",
                                        "shared@example.test",
                                        "Tenant A Name",
                                        "User",
                                        true,
                                        "ACTIVE",
                                        List.of())));

        service.updateMembership(
                400L,
                new TenantAccessManagementService.UpdateMembershipRequest(
                        "Tenant A Name", null, true));

        verify(repository).updateMembershipProfile(TENANT_A, 400L, "Tenant A Name", null, true);
    }

    @Test
    void roleAssignmentAndRevocationAreBoundToTheCurrentTenant() {
        when(repository.userMembershipExists(TENANT_A, 400L)).thenReturn(true);
        when(repository.roleExists(TENANT_A, 90L)).thenReturn(true);
        when(repository.revokeRole(TENANT_A, 400L, 90L)).thenReturn(1);

        service.assignRole(400L, 90L);
        service.revokeRole(400L, 90L);

        verify(repository).assignRole(TENANT_A, 400L, 90L);
        verify(repository).revokeRole(TENANT_A, 400L, 90L);
        verify(repository, never()).assignRole(TENANT_B, 400L, 90L);
        verify(repository, never()).revokeRole(TENANT_B, 400L, 90L);
    }

    @Test
    void refusesToRevokeTheLastActiveAdministratorMembership() {
        when(repository.isActiveRoleManager(TENANT_A, 400L)).thenReturn(true);
        when(repository.countActiveRoleManagersExcludingUser(TENANT_A, 400L)).thenReturn(0L);

        ResponseStatusException exception =
                assertThrows(ResponseStatusException.class, () -> service.revokeMembership(400L));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        verify(repository).lockTenantForAccessChange(TENANT_A);
        verify(repository, never()).revokeMembership(TENANT_A, 400L);
    }

    @Test
    void refusesToRevokeRoleWhenItIsTheLastActiveSourceOfAdminPermission() {
        when(repository.userMembershipExists(TENANT_A, 400L)).thenReturn(true);
        when(repository.roleExists(TENANT_A, 90L)).thenReturn(true);
        when(repository.isActiveRoleManagerOnlyThroughRole(TENANT_A, 400L, 90L))
                .thenReturn(true);
        when(repository.countActiveRoleManagersExcludingUser(TENANT_A, 400L)).thenReturn(0L);

        ResponseStatusException exception =
                assertThrows(ResponseStatusException.class, () -> service.revokeRole(400L, 90L));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        verify(repository, never()).revokeRole(TENANT_A, 400L, 90L);
    }

    @Test
    void refusesToRemoveAdminPermissionFromTheLastActiveAdminRole() {
        when(repository.roleExists(TENANT_A, 90L)).thenReturn(true);
        when(repository.permissionIds(List.of("users.read"))).thenReturn(List.of(1L));
        when(repository.isActiveRoleManagerThroughRole(TENANT_A, 90L)).thenReturn(true);
        when(repository.countActiveRoleManagersExcludingRole(TENANT_A, 90L)).thenReturn(0L);

        ResponseStatusException exception =
                assertThrows(
                        ResponseStatusException.class,
                        () ->
                                service.replaceRolePermissions(
                                        90L,
                                        new TenantAccessManagementService
                                                .ReplaceRolePermissionsRequest(
                                                List.of("users.read"))));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        verify(repository, never()).removeRolePermissions(TENANT_A, 90L);
    }
}

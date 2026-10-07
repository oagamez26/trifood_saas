package com.potoquitos.saas.users;

import com.potoquitos.saas.users.TenantAccessManagementRepository.PermissionView;
import com.potoquitos.saas.users.TenantAccessManagementRepository.TenantRoleView;
import com.potoquitos.saas.users.TenantAccessManagementRepository.TenantUserView;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class TenantAccessManagementController {
    private final TenantAccessManagementService service;

    public TenantAccessManagementController(TenantAccessManagementService service) {
        this.service = service;
    }

    @GetMapping("/users")
    @PreAuthorize("hasAuthority('PERMISSION_users.read')")
    public List<TenantUserView> listUsers() {
        return service.listUsers();
    }

    @GetMapping("/tenant-memberships")
    @PreAuthorize("hasAuthority('PERMISSION_users.read')")
    public List<TenantUserView> listMemberships() {
        return service.listUsers();
    }

    @GetMapping("/users/{userId}")
    @PreAuthorize("hasAuthority('PERMISSION_users.read')")
    public TenantUserView getUser(@PathVariable long userId) {
        return service.getUser(userId);
    }

    @GetMapping("/tenant-memberships/{userId}")
    @PreAuthorize("hasAuthority('PERMISSION_users.read')")
    public TenantUserView getMembership(@PathVariable long userId) {
        return service.getUser(userId);
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('PERMISSION_users.create')")
    public TenantUserView createUser(
            @Valid @RequestBody TenantAccessManagementService.CreateUserRequest request) {
        return service.createUser(request);
    }

    @PostMapping("/tenant-memberships")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('PERMISSION_users.memberships.manage')")
    public TenantUserView addMembership(
            @Valid @RequestBody TenantAccessManagementService.AddMembershipRequest request) {
        return service.addMembership(request);
    }

    @PatchMapping("/tenant-memberships/{userId}")
    @PreAuthorize("hasAuthority('PERMISSION_users.update')")
    public TenantUserView updateMembership(
            @PathVariable long userId,
            @Valid @RequestBody TenantAccessManagementService.UpdateMembershipRequest request) {
        return service.updateMembership(userId, request);
    }

    @DeleteMapping("/tenant-memberships/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('PERMISSION_users.memberships.manage')")
    public void revokeMembership(@PathVariable long userId) {
        service.revokeMembership(userId);
    }

    @GetMapping("/roles")
    @PreAuthorize("hasAuthority('PERMISSION_roles.read')")
    public List<TenantRoleView> listRoles() {
        return service.listRoles();
    }

    @GetMapping("/permissions")
    @PreAuthorize("hasAuthority('PERMISSION_roles.read')")
    public List<PermissionView> listPermissions() {
        return service.listPermissions();
    }

    @PostMapping("/roles")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('PERMISSION_roles.manage')")
    public TenantRoleView createRole(
            @Valid @RequestBody TenantAccessManagementService.CreateRoleRequest request) {
        return service.createRole(request);
    }

    @PutMapping("/roles/{roleId}/permissions")
    @PreAuthorize("hasAuthority('PERMISSION_roles.manage')")
    public TenantRoleView replaceRolePermissions(
            @PathVariable long roleId,
            @Valid
                    @RequestBody
                    TenantAccessManagementService.ReplaceRolePermissionsRequest request) {
        return service.replaceRolePermissions(roleId, request);
    }

    @PutMapping("/users/{userId}/roles/{roleId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('PERMISSION_users.roles.assign')")
    public void assignRole(@PathVariable long userId, @PathVariable long roleId) {
        service.assignRole(userId, roleId);
    }

    @DeleteMapping("/users/{userId}/roles/{roleId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('PERMISSION_users.roles.assign')")
    public void revokeRole(@PathVariable long userId, @PathVariable long roleId) {
        service.revokeRole(userId, roleId);
    }
}

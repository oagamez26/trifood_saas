package com.potoquitos.saas.shared.web;

import com.potoquitos.saas.auth.LoginService.TenantSelectionRequiredException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> invalidCredentials() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError("invalid_credentials", "Invalid credentials"));
    }

    @ExceptionHandler(TenantSelectionRequiredException.class)
    public ResponseEntity<ApiError> tenantSelectionRequired() {
        return ResponseEntity.badRequest()
                .body(new ApiError("tenant_selection_required", "Select an active tenant"));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> dataConflict() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError("data_conflict", "The requested change conflicts with existing data"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> invalidRequest() {
        return ResponseEntity.badRequest()
                .body(new ApiError("invalid_request", "Request validation failed"));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> responseStatus(ResponseStatusException exception) {
        String reason = exception.getReason() == null ? "Request failed" : exception.getReason();
        return ResponseEntity.status(exception.getStatusCode())
                .body(new ApiError("request_failed", reason));
    }

    public record ApiError(String code, String message) {}
}

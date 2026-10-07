package com.potoquitos.saas.catalog;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/catalog/categories")
public class CatalogCategoryController {
    private final CatalogCategoryService categoryService;

    public CatalogCategoryController(CatalogCategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PERMISSION_catalog.categories.read')")
    public List<CategoryResponse> list() {
        return categoryService.findAllForCurrentTenant().stream()
                .map(
                        category ->
                                new CategoryResponse(
                                        category.getId(),
                                        category.getName(),
                                        category.isActive(),
                                        category.getDisplayOrder()))
                .toList();
    }

    public record CategoryResponse(
            Integer id, String name, boolean active, int displayOrder) {}
}

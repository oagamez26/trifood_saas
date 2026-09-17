# C4 — Nivel de Código: Cocina, Inventario y Kardex

Este diagrama C4 documenta la interacción a nivel de código entre la gestión de cola KDS en Cocina, la explosión de materiales según Recetario y el descuento transaccional e idempotente en el **Kardex** e Inventario.

---

## 1. Elementos Reales del Código

- **Enrutadores:**
  - `presentation/kitchen_routes.py` (`kitchen_router`)
  - `presentation/inventory_routes.py` (`inventory_router`)
- **Repositorios:**
  - `infrastructure/repositories.py` (`KitchenRepository`)
  - `infrastructure/repositories.py` (`InventoryRepository`)
  - `infrastructure/repositories.py` (`RecipeRepository`)
- **Modelos SQLAlchemy:** `infrastructure/models.py`:
  - `Ingredient` (`ingredients`)
  - `Recipe` (`recipes`)
  - `RecipeItem` (`recipe_items`)
  - `InventoryMovement` (`inventory_movements`)
  - `KardexEntry` (`kardex_entries`)
  - `Order` (`orders`) y `OrderLine` (`order_lines`)
- **Esquemas Pydantic:** `presentation/schemas.py`:
  - `MovementIn`
  - `IngredientIn`
  - `RecipeIn`
  - `RecipeItemIn`

---

## 2. Diagrama de Clases C4 (Mermaid)

```mermaid
classDiagram
    class KitchenRouter {
        +get_kitchen_queue(user, uow)
        +start_preparation(order_id, user, uow)
        +mark_as_ready(order_id, user, uow)
    }

    class InventoryRouter {
        +list_ingredients(active_only, user, uow)
        +create_ingredient(data: IngredientIn, user, uow)
        +register_movement(data: MovementIn, user, uow)
        +list_movements(ingredient_id, user, uow)
        +get_kardex(ingredient_id, user, uow)
        +get_recipe(product_id, user, uow)
        +save_recipe(product_id, data: RecipeIn, user, uow)
    }

    class KitchenRepository {
        -session: Session
        +queue() list
        +update_state(order_id, target_state, user_id) dict
    }

    class InventoryRepository {
        -session: Session
        +ingredient(ingredient_id, lock=False) dict
        +ingredients(active_only=False) list
        +save_ingredient(data, ingredient_id=None) dict
        +add_movement(ingredient_id, movement_type, quantity, responsible_id, reference) dict
        +movements(ingredient_id=None) list
        +kardex(ingredient_id=None) list
    }

    class RecipeRepository {
        -session: Session
        +recipe_for_product(product_id) dict
        +save_recipe(product_id, items, notes) dict
    }

    class Ingredient {
        +int id
        +str name
        +str base_unit
        +Numeric stock
        +Numeric min_stock
        +Numeric reference_cost
        +bool is_active
        +datetime created_at
        +datetime updated_at
    }

    class Recipe {
        +int id
        +int product_id
        +str notes
        +datetime created_at
        +datetime updated_at
    }

    class RecipeItem {
        +int id
        +int recipe_id
        +int ingredient_id
        +Numeric quantity
        +str unit
    }

    class InventoryMovement {
        +int id
        +int ingredient_id
        +str movement_type
        +Numeric quantity
        +Numeric previous_stock
        +Numeric new_stock
        +str reference
        +int responsible_user_id
        +datetime created_at
    }

    class KardexEntry {
        +int id
        +int ingredient_id
        +str movement_type
        +Numeric entry_quantity
        +Numeric exit_quantity
        +Numeric previous_balance
        +Numeric new_balance
        +str reference
        +int responsible_user_id
        +datetime created_at
    }

    KitchenRouter --> KitchenRepository : Despacha
    InventoryRouter --> InventoryRepository : Consulta / Actualiza
    InventoryRouter --> RecipeRepository : Consulta / Define

    KitchenRepository ..> Recipe : Consulta explosión de insumos
    KitchenRepository ..> Ingredient : Bloquea y descuenta stock
    KitchenRepository ..> InventoryMovement : Asienta consumo
    KitchenRepository ..> KardexEntry : Registra salida inmutable

    Recipe "1" *-- "*" RecipeItem : Compone
    RecipeItem --> Ingredient : Referencia insumo base
    Ingredient "1" *-- "*" InventoryMovement : Historial de movimientos
    Ingredient "1" *-- "*" KardexEntry : Trazabilidad contable
```

---

## 3. Lógica Real de Idempotencia y Descuento en Cocina

En `KitchenRepository.update_state()` (dentro de `repositories.py`):
1. **Validación de Estado Inicial:**
   - La orden debe estar en `CONFIRMADO` o `EN_COCINA`.
2. **Chequeo de Descuento Previo:**
   ```python
   if target_state == "EN_PREPARACION" and not order.inventory_deducted:
       # Se ejecuta la verificación de stock y descuento por receta
       ...
       order.inventory_deducted = True
   ```
3. **Verificación de Stock Físico:**
   - Si el inventario disponible de cualquier ingrediente es menor al requerido, se detiene la transacción y se genera un error atómico `INSUFFICIENT_STOCK` (409).
4. **Idempotencia Absoluta:**
   - Si la comanda ya tenía `inventory_deducted == True`, la preparación se activa sin descontar inventario dos veces.
   - Pasar de `EN_PREPARACION` a `LISTO` **no** vuelve a tocar el inventario.

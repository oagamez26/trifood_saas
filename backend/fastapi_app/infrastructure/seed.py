from decimal import Decimal
from sqlalchemy import select
from .models import (
    Role,
    Permission,
    User,
    Category,
    Product,
    DiningTable,
    Ingredient,
    Recipe,
    RecipeItem,
    InventoryMovement,
    KardexEntry,
    CashRegister,
    ExpenseCategory,
    RestaurantSetting,
)
from ..shared.domain.rules import now
from werkzeug.security import generate_password_hash

BASE_ROLES = ("ADMINISTRADOR", "MESERO", "COCINA", "CAJERO")

BASE_PERMISSIONS = (
    "user.view",
    "user.create",
    "user.update",
    "role.view",
    "role.assign",
    "role.update",
    "audit.view",
    "category.view",
    "category.create",
    "category.update",
    "category.disable",
    "product.view",
    "product.create",
    "product.update",
    "product.disable",
    "product.change_price",
    "product.change_availability",
    "table.view",
    "table.create",
    "table.update",
    "table.open",
    "table.close",
    "order.view",
    "order.create",
    "order.update_draft",
    "order.confirm",
    "order.cancel",
    "order.deliver",
    "order.prepare",
    "kitchen.view",
    "kitchen.advance",
    "inventory.view",
    "inventory.adjust",
    "recipe.view",
    "recipe.update",
    "cash.view",
    "cash.open",
    "cash.close",
    "payment.view",
    "payment.process",
    "invoice.view",
    "expense.view",
    "expense.create",
    "report.view",
    "prediction.view",
    "settings.view",
    "settings.update",
)

ROLE_PERMISSIONS_MAP = {
    "ADMINISTRADOR": BASE_PERMISSIONS,
    "MESERO": (
        "category.view",
        "table.view",
        "table.open",
        "order.view",
        "order.create",
        "order.confirm",
        "order.cancel",
        "order.deliver",
        "order.prepare",
    ),

    "COCINA": (
        "kitchen.view",
        "kitchen.advance",
        "order.view",
        "product.view",
        "recipe.view",
        "inventory.view",
    ),
    "CAJERO": (
        "category.view",
        "product.view",
        "table.view",
        "order.view",
        "cash.view",
        "cash.open",
        "cash.close",
        "payment.view",
        "payment.process",
        "invoice.view",
    ),
}


def seed_authorization(session):
    # 1. Roles
    roles_obj = {}
    for name in BASE_ROLES:
        role = session.scalar(select(Role).where(Role.name == name))
        if not role:
            role = Role(name=name, description=f"Rol de {name.capitalize()}")
            session.add(role)
        roles_obj[name] = role
    session.flush()

    # 2. Permissions
    perms_obj = {}
    for code in BASE_PERMISSIONS:
        perm = session.scalar(select(Permission).where(Permission.codename == code))
        if not perm:
            perm = Permission(codename=code)
            session.add(perm)
        perms_obj[code] = perm
    session.flush()

    # 3. Assign permissions to roles
    for r_name, p_codes in ROLE_PERMISSIONS_MAP.items():
        role = roles_obj[r_name]
        for p_code in p_codes:
            perm = perms_obj[p_code]
            if perm not in role.permissions:
                role.permissions.append(perm)
    session.flush()


def seed_initial_data(session):
    seed_authorization(session)
    roles_obj = {r.name: r for r in session.scalars(select(Role)).all()}

    # Default Users
    users_data = [
        ("admin", "admin@potoquitos.com", "Super", "Admin", "Admin12345*", ["ADMINISTRADOR"]),
        ("mesero1", "mesero1@potoquitos.com", "Carlos", "Mesero", "Mesero12345*", ["MESERO"]),
        ("cocina1", "cocina1@potoquitos.com", "Mario", "Cocinero", "Cocina12345*", ["COCINA"]),
        ("cajero1", "cajero1@potoquitos.com", "Ana", "Cajera", "Cajero12345*", ["CAJERO"]),
    ]
    for username, email, first, last, password, u_roles in users_data:
        user = session.scalar(select(User).where(User.username == username))
        if not user:
            user = User(
                username=username,
                email=email,
                first_name=first,
                last_name=last,
                password_hash=generate_password_hash(password),
                is_active=True,
                roles=[roles_obj[r] for r in u_roles],
            )
            session.add(user)
    session.flush()

    # 5. Categories
    categories_data = [
        ("Hamburguesas", "Hamburguesas artesanales con ingredientes frescos", 1),
        ("Perros", "Perros calientes con salchicha especial", 2),
        ("Picadas", "Picadas mixtas para compartir", 3),
        ("Bebidas", "Bebidas frías, jugos naturales y gaseosas", 4),
    ]
    cat_objs = {}
    for name, desc, order in categories_data:
        cat = session.scalar(select(Category).where(Category.name == name))
        if not cat:
            cat = Category(name=name, description=desc, display_order=order, is_active=True)
            session.add(cat)
        cat_objs[name] = cat
    session.flush()

    # 6. Products
    products_data = [
        ("HAMB-001", "Hamburguesa Clásica", "Carne 150g, pan brioche, queso, tomate y lechuga", Decimal("18000.00"), "Hamburguesas"),
        ("HAMB-002", "Hamburguesa Especial", "Carne 180g, tocineta, doble queso, tomate y lechuga", Decimal("24000.00"), "Hamburguesas"),
        ("PERR-001", "Perro Caliente Potoquitos", "Salchicha especial, pan suave, tocineta y queso", Decimal("15000.00"), "Perros"),
        ("PICA-001", "Picada Mixta Familiar", "Picada abundante con carnes, tocineta y papas", Decimal("45000.00"), "Picadas"),
        ("BEB-001", "Limonada Natural", "Limonada refrescante preparada al momento", Decimal("6000.00"), "Bebidas"),
        ("BEB-002", "Gaseosa 400ml", "Gaseosa en botella personal", Decimal("5000.00"), "Bebidas"),
    ]
    prod_objs = {}
    for code, name, desc, price, cat_name in products_data:
        prod = session.scalar(select(Product).where(Product.internal_code == code))
        if not prod:
            prod = Product(
                internal_code=code,
                name=name,
                description=desc,
                current_price=price,
                category_id=cat_objs[cat_name].id,
                is_active=True,
                is_available=True,
                price_version=1,
            )
            session.add(prod)
        prod_objs[code] = prod
    session.flush()

    # 7. Dining Tables
    for i in range(1, 9):
        num_str = f"Mesa {i}"
        tbl = session.scalar(select(DiningTable).where(DiningTable.number == num_str))
        if not tbl:
            tbl = DiningTable(number=num_str, capacity=4, is_active=True, state="DISPONIBLE")
            session.add(tbl)
    session.flush()

    # 8. Ingredients
    admin_user = session.scalar(select(User).where(User.username == "admin"))
    ingredients_data = [
        ("Carne de hamburguesa", "g", Decimal("15000"), Decimal("3000"), Decimal("40.00")),
        ("Pan de hamburguesa", "und", Decimal("100"), Decimal("20"), Decimal("1500.00")),
        ("Queso mozzarella", "und", Decimal("200"), Decimal("40"), Decimal("1000.00")),
        ("Tocineta", "g", Decimal("5000"), Decimal("1000"), Decimal("60.00")),
        ("Tomate fresco", "g", Decimal("5000"), Decimal("1000"), Decimal("20.00")),
        ("Lechuga fresca", "g", Decimal("4000"), Decimal("800"), Decimal("15.00")),
        ("Salchicha especial", "und", Decimal("80"), Decimal("20"), Decimal("2500.00")),
        ("Pan de perro", "und", Decimal("80"), Decimal("20"), Decimal("1200.00")),
        ("Papas a la francesa", "g", Decimal("20000"), Decimal("5000"), Decimal("25.00")),
        ("Limón fresco", "und", Decimal("150"), Decimal("30"), Decimal("800.00")),
        ("Azúcar", "g", Decimal("10000"), Decimal("2000"), Decimal("10.00")),
        ("Gaseosa botella", "und", Decimal("120"), Decimal("24"), Decimal("3000.00")),
    ]
    ing_objs = {}
    for name, unit, stock, min_stock, cost in ingredients_data:
        ing = session.scalar(select(Ingredient).where(Ingredient.name == name))
        if not ing:
            ing = Ingredient(
                name=name,
                base_unit=unit,
                stock=stock,
                min_stock=min_stock,
                reference_cost=cost,
                is_active=True,
            )
            session.add(ing)
            session.flush()
            # Add initial Kardex movement
            session.add(
                InventoryMovement(
                    ingredient_id=ing.id,
                    movement_type="ENTRADA_MANUAL",
                    quantity=stock,
                    previous_stock=Decimal("0"),
                    new_stock=stock,
                    reference="Inventario Inicial",
                    responsible_user_id=admin_user.id,
                )
            )
            session.add(
                KardexEntry(
                    ingredient_id=ing.id,
                    movement_type="ENTRADA_MANUAL",
                    entry_quantity=stock,
                    exit_quantity=Decimal("0"),
                    previous_balance=Decimal("0"),
                    new_balance=stock,
                    reference="Inventario Inicial",
                    responsible_user_id=admin_user.id,
                )
            )
        ing_objs[name] = ing
    session.flush()

    # 9. Recipes
    recipes_spec = [
        ("HAMB-001", [("Carne de hamburguesa", 150, "g"), ("Pan de hamburguesa", 1, "und"), ("Queso mozzarella", 1, "und"), ("Tomate fresco", 20, "g"), ("Lechuga fresca", 20, "g")]),
        ("HAMB-002", [("Carne de hamburguesa", 180, "g"), ("Pan de hamburguesa", 1, "und"), ("Queso mozzarella", 2, "und"), ("Tocineta", 40, "g"), ("Tomate fresco", 25, "g"), ("Lechuga fresca", 25, "g")]),
        ("PERR-001", [("Salchicha especial", 1, "und"), ("Pan de perro", 1, "und"), ("Queso mozzarella", 1, "und"), ("Tocineta", 20, "g")]),
        ("BEB-001", [("Limón fresco", 2, "und"), ("Azúcar", 30, "g")]),
    ]
    for prod_code, items in recipes_spec:
        prod = prod_objs[prod_code]
        rec = session.scalar(select(Recipe).where(Recipe.product_id == prod.id))
        if not rec:
            rec = Recipe(product_id=prod.id, notes=f"Receta oficial de {prod.name}")
            session.add(rec)
            session.flush()
            for ing_name, qty, unit in items:
                session.add(
                    RecipeItem(
                        recipe_id=rec.id,
                        ingredient_id=ing_objs[ing_name].id,
                        quantity=Decimal(str(qty)),
                        unit=unit,
                    )
                )
    session.flush()

    # 10. Cash Registers
    for c_name in ("Caja Principal", "Caja Secundaria"):
        cr = session.scalar(select(CashRegister).where(CashRegister.name == c_name))
        if not cr:
            session.add(CashRegister(name=c_name, is_active=True))
    session.flush()

    # 11. Expense Categories
    exp_cats = [
        "Arriendo", "Energía", "Agua", "Gas", "Internet", "Mantenimiento", "Transporte", "Nómina", "Insumos generales", "Otros"
    ]
    for cat_name in exp_cats:
        ec = session.scalar(select(ExpenseCategory).where(ExpenseCategory.name == cat_name))
        if not ec:
            session.add(ExpenseCategory(name=cat_name, description=f"Gastos de {cat_name}"))
    session.flush()

    # 12. Settings & Credits
    settings_data = {
        "restaurant_name": "POTOQUITOS",
        "restaurant_nit": "901.458.789-2",
        "restaurant_address": "Calle 45 # 28 - 14, Barranquilla, Colombia",
        "restaurant_phone": "+57 300 123 4567",
        "invoice_prefix": "FAC-",
        "public_menu_enabled": "true",
        "developer_credits": "Carlos Reales, Orlando Agamez",
        "prediction_safety_margin": "1.20",
    }
    for k, v in settings_data.items():
        st = session.scalar(select(RestaurantSetting).where(RestaurantSetting.key == k))
        if not st:
            session.add(RestaurantSetting(key=k, value=v, description=f"Configuración de {k}"))
    session.flush()
    session.commit()

from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy.orm import DeclarativeBase, relationship


def utc_now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


# ==========================================
# AUTH & USERS (001-auth, 002-users)
# ==========================================

user_roles = sa.Table(
    "user_roles",
    Base.metadata,
    sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    sa.Column("role_id", sa.Integer, sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    sa.Column("created_at", sa.DateTime(timezone=True), default=utc_now, nullable=False),
)

role_permissions = sa.Table(
    "role_permissions",
    Base.metadata,
    sa.Column("role_id", sa.Integer, sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    sa.Column("permission_id", sa.Integer, sa.ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
    sa.Column("created_at", sa.DateTime(timezone=True), default=utc_now, nullable=False),
)


class User(Base):
    __tablename__ = "users"

    id = sa.Column(sa.Integer, primary_key=True)
    username = sa.Column(sa.String(80), unique=True, nullable=False, index=True)
    email = sa.Column(sa.String(255), unique=True, nullable=False, index=True)
    first_name = sa.Column(sa.String(100), nullable=False)
    last_name = sa.Column(sa.String(100), nullable=False)
    password_hash = sa.Column(sa.String(255), nullable=False)
    is_active = sa.Column(sa.Boolean, nullable=False, default=True)
    must_change_password = sa.Column(sa.Boolean, nullable=False, default=False)
    token_version = sa.Column(sa.Integer, nullable=False, default=0)
    reset_token_hash = sa.Column(sa.String(128), nullable=True)
    reset_token_expires_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    roles = relationship("Role", secondary=user_roles, back_populates="users")


class Role(Base):
    __tablename__ = "roles"

    id = sa.Column(sa.Integer, primary_key=True)
    name = sa.Column(sa.String(80), unique=True, nullable=False)
    description = sa.Column(sa.String(255), nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    users = relationship("User", secondary=user_roles, back_populates="roles")
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")


class Permission(Base):
    __tablename__ = "permissions"

    id = sa.Column(sa.Integer, primary_key=True)
    codename = sa.Column(sa.String(120), unique=True, nullable=False, index=True)
    description = sa.Column(sa.String(255), nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)

    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = sa.Column(sa.Integer, primary_key=True)
    actor_user_id = sa.Column(sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    target_user_id = sa.Column(sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = sa.Column(sa.String(120), nullable=False)
    details = sa.Column(sa.JSON, nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)


# ==========================================
# CATALOG & PRODUCTS (004-categories, 005-products, 006-public-menu)
# ==========================================

class Category(Base):
    __tablename__ = "catalog_categories"

    id = sa.Column(sa.Integer, primary_key=True)
    name = sa.Column(sa.String(120), unique=True, nullable=False, index=True)
    description = sa.Column(sa.Text, nullable=True)
    is_active = sa.Column(sa.Boolean, nullable=False, default=True)
    display_order = sa.Column(sa.Integer, nullable=False, default=0)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "catalog_products"

    id = sa.Column(sa.Integer, primary_key=True)
    internal_code = sa.Column(sa.String(80), unique=True, nullable=False, index=True)
    name = sa.Column(sa.String(160), nullable=False, index=True)
    description = sa.Column(sa.Text, nullable=False)
    current_price = sa.Column(sa.Numeric(12, 2), nullable=False)
    currency = sa.Column(sa.String(3), nullable=False, default="COP", server_default="COP")
    price_version = sa.Column(sa.Integer, nullable=False, default=1, server_default="1")
    category_id = sa.Column(sa.Integer, sa.ForeignKey("catalog_categories.id"), nullable=False, index=True)
    recommended_people = sa.Column(sa.Integer, nullable=True)
    is_active = sa.Column(sa.Boolean, nullable=False, default=True, index=True)
    is_available = sa.Column(sa.Boolean, nullable=False, default=True, index=True)
    current_image_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("catalog_product_images.id", use_alter=True, name="fk_product_current_image"),
        nullable=True,
    )
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    category = relationship("Category", back_populates="products", foreign_keys=[category_id])
    images = relationship("ProductImage", back_populates="product", foreign_keys="ProductImage.product_id")
    price_history = relationship("ProductPriceHistory", back_populates="product", order_by="ProductPriceHistory.changed_at.desc()")
    current_image = relationship("ProductImage", foreign_keys=[current_image_id], post_update=True)
    recipe = relationship("Recipe", back_populates="product", uselist=False)


class ProductImage(Base):
    __tablename__ = "catalog_product_images"

    id = sa.Column(sa.Integer, primary_key=True)
    product_id = sa.Column(sa.Integer, sa.ForeignKey("catalog_products.id", ondelete="CASCADE"), nullable=False, index=True)
    file_reference = sa.Column(sa.String(500), nullable=False)
    is_current = sa.Column(sa.Boolean, nullable=False, default=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    replaced_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    uploaded_by = sa.Column(sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    product = relationship("Product", back_populates="images", foreign_keys=[product_id])


class ProductPriceHistory(Base):
    __tablename__ = "catalog_product_price_history"

    id = sa.Column(sa.Integer, primary_key=True)
    product_id = sa.Column(sa.Integer, sa.ForeignKey("catalog_products.id", ondelete="CASCADE"), nullable=False, index=True)
    previous_price = sa.Column(sa.Numeric(12, 2), nullable=True)
    new_price = sa.Column(sa.Numeric(12, 2), nullable=False)
    currency = sa.Column(sa.String(3), nullable=False, default="COP", server_default="COP")
    price_version = sa.Column(sa.Integer, nullable=False, default=1)
    changed_by = sa.Column(sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    changed_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)

    product = relationship("Product", back_populates="price_history")


class CatalogAuditEvent(Base):
    __tablename__ = "catalog_audit_events"

    id = sa.Column(sa.Integer, primary_key=True)
    actor_user_id = sa.Column(sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    entity_type = sa.Column(sa.String(40), nullable=False)
    entity_id = sa.Column(sa.Integer, nullable=False)
    action = sa.Column(sa.String(80), nullable=False)
    details = sa.Column(sa.JSON, nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)


# ==========================================
# TABLES & ORDERS (007-tables, 008-orders, 009-kitchen)
# ==========================================

class DiningTable(Base):
    __tablename__ = "dining_tables"

    id = sa.Column(sa.Integer, primary_key=True)
    number = sa.Column(sa.String(30), unique=True, nullable=False)
    capacity = sa.Column(sa.Integer, nullable=False, default=4)
    is_active = sa.Column(sa.Boolean, nullable=False, default=True)
    state = sa.Column(sa.String(30), nullable=False, default="DISPONIBLE")  # DISPONIBLE, OCUPADA, EN_ATENCION, PENDIENTE_PAGO
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    sessions = relationship("TableSession", back_populates="table")


class TableSession(Base):
    __tablename__ = "table_sessions"

    id = sa.Column(sa.Integer, primary_key=True)
    table_id = sa.Column(sa.Integer, sa.ForeignKey("dining_tables.id"), nullable=False, index=True)
    waiter_id = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=False)
    people_count = sa.Column(sa.Integer, nullable=False, default=1)
    state = sa.Column(sa.String(30), nullable=False, default="OPEN")  # OPEN, CLOSED
    opened_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    closed_at = sa.Column(sa.DateTime(timezone=True), nullable=True)

    table = relationship("DiningTable", back_populates="sessions")
    orders = relationship("Order", back_populates="table_session")
    payments = relationship("Payment", back_populates="table_session")


class Order(Base):
    __tablename__ = "orders"

    id = sa.Column(sa.Integer, primary_key=True)
    table_session_id = sa.Column(sa.Integer, sa.ForeignKey("table_sessions.id"), nullable=False, index=True)
    waiter_id = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=False)
    state = sa.Column(sa.String(30), nullable=False, default="BORRADOR", server_default="BORRADOR", index=True)  # BORRADOR, CONFIRMADO, EN_COCINA, EN_PREPARACION, LISTO, ENTREGADO, CANCELADO
    account_requested = sa.Column(sa.Boolean, nullable=False, default=False)
    inventory_deducted = sa.Column(sa.Boolean, nullable=False, default=False, server_default=sa.text("false"))
    notes = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    confirmed_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    in_kitchen_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    ready_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    delivered_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    closed_at = sa.Column(sa.DateTime(timezone=True), nullable=True)

    table_session = relationship("TableSession", back_populates="orders")
    lines = relationship("OrderLine", back_populates="order", cascade="all, delete-orphan")
    cancellation = relationship("OrderCancellation", back_populates="order", uselist=False)


class OrderLine(Base):
    __tablename__ = "order_lines"

    id = sa.Column(sa.Integer, primary_key=True)
    order_id = sa.Column(sa.Integer, sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = sa.Column(sa.Integer, sa.ForeignKey("catalog_products.id"), nullable=False)
    product_name = sa.Column(sa.String(160), nullable=False)
    unit_price = sa.Column(sa.Numeric(12, 2), nullable=False)
    quantity = sa.Column(sa.Integer, nullable=False)
    notes = sa.Column(sa.Text, nullable=True)

    order = relationship("Order", back_populates="lines")
    product = relationship("Product")


class OrderCancellation(Base):
    __tablename__ = "order_cancellations"

    id = sa.Column(sa.Integer, primary_key=True)
    order_id = sa.Column(sa.Integer, sa.ForeignKey("orders.id", ondelete="CASCADE"), unique=True, nullable=False)
    reason = sa.Column(sa.Text, nullable=False)
    cancelled_by = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=False)
    cancelled_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)

    order = relationship("Order", back_populates="cancellation")


# ==========================================
# INGREDIENTS, RECIPES, INVENTORY & KARDEX (010-inventory, 011-ingredients, 012-recipes, 013-kardex)
# ==========================================

class Ingredient(Base):
    __tablename__ = "ingredients"

    id = sa.Column(sa.Integer, primary_key=True)
    name = sa.Column(sa.String(120), unique=True, nullable=False, index=True)
    description = sa.Column(sa.Text, nullable=True)
    base_unit = sa.Column(sa.String(20), nullable=False)  # kg, g, L, ml, und, paquete, caja, porcion
    stock = sa.Column(sa.Numeric(12, 4), nullable=False, default=0)
    min_stock = sa.Column(sa.Numeric(12, 4), nullable=False, default=0)
    reference_cost = sa.Column(sa.Numeric(12, 2), nullable=False, default=0)  # costo en COP por unidad base
    is_active = sa.Column(sa.Boolean, nullable=False, default=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    recipe_items = relationship("RecipeItem", back_populates="ingredient")
    movements = relationship("InventoryMovement", back_populates="ingredient")
    kardex_entries = relationship("KardexEntry", back_populates="ingredient")


class Recipe(Base):
    __tablename__ = "recipes"

    id = sa.Column(sa.Integer, primary_key=True)
    product_id = sa.Column(sa.Integer, sa.ForeignKey("catalog_products.id", ondelete="CASCADE"), unique=True, nullable=False)
    notes = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    product = relationship("Product", back_populates="recipe")
    items = relationship("RecipeItem", back_populates="recipe", cascade="all, delete-orphan")


class RecipeItem(Base):
    __tablename__ = "recipe_items"

    id = sa.Column(sa.Integer, primary_key=True)
    recipe_id = sa.Column(sa.Integer, sa.ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    ingredient_id = sa.Column(sa.Integer, sa.ForeignKey("ingredients.id"), nullable=False)
    quantity = sa.Column(sa.Numeric(12, 4), nullable=False)  # cantidad consumida por unidad de producto
    unit = sa.Column(sa.String(20), nullable=False)

    recipe = relationship("Recipe", back_populates="items")
    ingredient = relationship("Ingredient", back_populates="recipe_items")


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = sa.Column(sa.Integer, primary_key=True)
    ingredient_id = sa.Column(sa.Integer, sa.ForeignKey("ingredients.id"), nullable=False, index=True)
    movement_type = sa.Column(sa.String(30), nullable=False)  # ENTRADA_MANUAL, CONSUMO_POR_PEDIDO, MERMA, AJUSTE_POSITIVO, AJUSTE_NEGATIVO, REVERSION
    quantity = sa.Column(sa.Numeric(12, 4), nullable=False)
    previous_stock = sa.Column(sa.Numeric(12, 4), nullable=False)
    new_stock = sa.Column(sa.Numeric(12, 4), nullable=False)
    reference = sa.Column(sa.String(120), nullable=True)
    responsible_user_id = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=False)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)

    ingredient = relationship("Ingredient", back_populates="movements")
    responsible_user = relationship("User")


class KardexEntry(Base):
    __tablename__ = "kardex_entries"

    id = sa.Column(sa.Integer, primary_key=True)
    ingredient_id = sa.Column(sa.Integer, sa.ForeignKey("ingredients.id"), nullable=False, index=True)
    movement_type = sa.Column(sa.String(30), nullable=False)
    entry_quantity = sa.Column(sa.Numeric(12, 4), nullable=False, default=0)
    exit_quantity = sa.Column(sa.Numeric(12, 4), nullable=False, default=0)
    previous_balance = sa.Column(sa.Numeric(12, 4), nullable=False)
    new_balance = sa.Column(sa.Numeric(12, 4), nullable=False)
    reference = sa.Column(sa.String(120), nullable=True)
    responsible_user_id = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=False)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)

    ingredient = relationship("Ingredient", back_populates="kardex_entries")
    responsible_user = relationship("User")


# ==========================================
# CASH, PAYMENTS & INVOICES (014-cash-registers, 015-payments, 016-invoices)
# ==========================================

class CashRegister(Base):
    __tablename__ = "cash_registers"

    id = sa.Column(sa.Integer, primary_key=True)
    name = sa.Column(sa.String(80), unique=True, nullable=False)
    is_active = sa.Column(sa.Boolean, nullable=False, default=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)

    sessions = relationship("CashSession", back_populates="cash_register")


class CashSession(Base):
    __tablename__ = "cash_sessions"

    id = sa.Column(sa.Integer, primary_key=True)
    cash_register_id = sa.Column(sa.Integer, sa.ForeignKey("cash_registers.id"), nullable=False, index=True)
    cashier_id = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=False)
    state = sa.Column(sa.String(20), nullable=False, default="OPEN")  # OPEN, CLOSED
    initial_cash = sa.Column(sa.Numeric(12, 2), nullable=False)
    expected_cash = sa.Column(sa.Numeric(12, 2), nullable=True)
    reported_cash = sa.Column(sa.Numeric(12, 2), nullable=True)
    difference = sa.Column(sa.Numeric(12, 2), nullable=True)
    closure_status = sa.Column(sa.String(20), nullable=True)  # CUADRADA, SOBRANTE, FALTANTE
    notes = sa.Column(sa.Text, nullable=True)
    opened_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    closed_at = sa.Column(sa.DateTime(timezone=True), nullable=True)

    sales_amount = sa.Column(sa.Numeric(12, 2), nullable=True, default=0)
    tips_amount = sa.Column(sa.Numeric(12, 2), nullable=True, default=0)
    total_collected = sa.Column(sa.Numeric(12, 2), nullable=True, default=0)
    cash_collected = sa.Column(sa.Numeric(12, 2), nullable=True, default=0)
    card_collected = sa.Column(sa.Numeric(12, 2), nullable=True, default=0)
    transfer_collected = sa.Column(sa.Numeric(12, 2), nullable=True, default=0)
    cash_expenses = sa.Column(sa.Numeric(12, 2), nullable=True, default=0)

    cash_register = relationship("CashRegister", back_populates="sessions")
    cashier = relationship("User")
    payments = relationship("Payment", back_populates="cash_session")


class Payment(Base):
    __tablename__ = "payments"

    id = sa.Column(sa.Integer, primary_key=True)
    table_session_id = sa.Column(sa.Integer, sa.ForeignKey("table_sessions.id"), nullable=False, index=True)
    cash_session_id = sa.Column(sa.Integer, sa.ForeignKey("cash_sessions.id"), nullable=False, index=True)
    cashier_id = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=False)
    consumption_amount = sa.Column(sa.Numeric(12, 2), nullable=False, default=0)
    tip_amount = sa.Column(sa.Numeric(12, 2), nullable=False, default=0)
    total_amount = sa.Column(sa.Numeric(12, 2), nullable=False)
    cash_received = sa.Column(sa.Numeric(12, 2), nullable=True)
    cash_change = sa.Column(sa.Numeric(12, 2), nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)

    table_session = relationship("TableSession", back_populates="payments")
    cash_session = relationship("CashSession", back_populates="payments")
    cashier = relationship("User")
    details = relationship("PaymentDetail", back_populates="payment", cascade="all, delete-orphan")
    invoice = relationship("Invoice", back_populates="payment", uselist=False)


class PaymentDetail(Base):
    __tablename__ = "payment_details"

    id = sa.Column(sa.Integer, primary_key=True)
    payment_id = sa.Column(sa.Integer, sa.ForeignKey("payments.id", ondelete="CASCADE"), nullable=False)
    payment_method = sa.Column(sa.String(30), nullable=False)  # EFECTIVO, TARJETA, TRANSFERENCIA
    amount = sa.Column(sa.Numeric(12, 2), nullable=False)
    reference_code = sa.Column(sa.String(100), nullable=True)

    payment = relationship("Payment", back_populates="details")


class Invoice(Base):
    __tablename__ = "invoices"

    id = sa.Column(sa.Integer, primary_key=True)
    invoice_number = sa.Column(sa.String(40), unique=True, nullable=False, index=True)  # FAC-000001
    payment_id = sa.Column(sa.Integer, sa.ForeignKey("payments.id"), unique=True, nullable=False)
    table_session_id = sa.Column(sa.Integer, sa.ForeignKey("table_sessions.id"), nullable=False)
    cashier_id = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=False)
    waiter_id = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=True)
    table_number = sa.Column(sa.String(30), nullable=False)
    subtotal = sa.Column(sa.Numeric(12, 2), nullable=False)
    tip = sa.Column(sa.Numeric(12, 2), nullable=False, default=0)
    tax = sa.Column(sa.Numeric(12, 2), nullable=False, default=0)
    total = sa.Column(sa.Numeric(12, 2), nullable=False)
    payment_method_summary = sa.Column(sa.String(120), nullable=False)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)

    payment = relationship("Payment", back_populates="invoice")
    cashier = relationship("User", foreign_keys=[cashier_id])
    waiter = relationship("User", foreign_keys=[waiter_id])
    lines = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id = sa.Column(sa.Integer, primary_key=True)
    invoice_id = sa.Column(sa.Integer, sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    order_line_id = sa.Column(sa.Integer, sa.ForeignKey("order_lines.id", ondelete="SET NULL"), nullable=True)
    product_id = sa.Column(sa.Integer, nullable=False)
    product_name = sa.Column(sa.String(160), nullable=False)
    quantity = sa.Column(sa.Integer, nullable=False)
    unit_price = sa.Column(sa.Numeric(12, 2), nullable=False)
    subtotal = sa.Column(sa.Numeric(12, 2), nullable=False)

    invoice = relationship("Invoice", back_populates="lines")


# ==========================================
# EXPENSES & COSTS (017-expenses-costs)
# ==========================================

class ExpenseCategory(Base):
    __tablename__ = "expense_categories"

    id = sa.Column(sa.Integer, primary_key=True)
    name = sa.Column(sa.String(80), unique=True, nullable=False)
    description = sa.Column(sa.String(255), nullable=True)

    expenses = relationship("Expense", back_populates="category")


class Expense(Base):
    __tablename__ = "expenses"

    id = sa.Column(sa.Integer, primary_key=True)
    category_id = sa.Column(sa.Integer, sa.ForeignKey("expense_categories.id"), nullable=False, index=True)
    concept = sa.Column(sa.String(200), nullable=False)
    amount = sa.Column(sa.Numeric(12, 2), nullable=False)
    expense_date = sa.Column(sa.Date, nullable=False)
    responsible_user_id = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=False)
    notes = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)

    category = relationship("ExpenseCategory", back_populates="expenses")
    responsible_user = relationship("User")


# ==========================================
# RESTAURANT SETTINGS & CREDITS (020-settings)
# ==========================================

class RestaurantSetting(Base):
    __tablename__ = "restaurant_settings"

    id = sa.Column(sa.Integer, primary_key=True)
    key = sa.Column(sa.String(80), unique=True, nullable=False, index=True)
    value = sa.Column(sa.Text, nullable=False)
    description = sa.Column(sa.String(255), nullable=True)
    updated_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


# ==========================================
# CONSTRAINTS & INDICES
# ==========================================

sa.Index("uq_category_normalized_name", sa.func.lower(sa.func.trim(Category.name)), unique=True)
sa.Index("uq_product_normalized_code", sa.func.upper(sa.func.trim(Product.internal_code)), unique=True)
sa.Index("uq_ingredient_normalized_name", sa.func.lower(sa.func.trim(Ingredient.name)), unique=True)

sa.Index(
    "uq_open_table_session",
    TableSession.table_id,
    unique=True,
    postgresql_where=TableSession.state == "OPEN",
    sqlite_where=TableSession.state == "OPEN",
)

sa.Index(
    "uq_open_cash_session",
    CashSession.cash_register_id,
    unique=True,
    postgresql_where=CashSession.state == "OPEN",
    sqlite_where=CashSession.state == "OPEN",
)

sa.Index(
    "uq_current_product_image",
    ProductImage.product_id,
    unique=True,
    postgresql_where=ProductImage.is_current.is_(True),
    sqlite_where=ProductImage.is_current.is_(True),
)

sa.UniqueConstraint(ProductPriceHistory.product_id, ProductPriceHistory.price_version, name="uq_price_history_version")
sa.CheckConstraint(Product.current_price >= 0, name="ck_product_price_nonnegative")
sa.CheckConstraint(Product.price_version > 0, name="ck_product_price_version")
sa.CheckConstraint(Product.currency == "COP", name="ck_product_currency")
sa.CheckConstraint(sa.or_(Product.recommended_people.is_(None), Product.recommended_people > 0), name="ck_product_people")
sa.CheckConstraint(Ingredient.stock >= 0, name="ck_ingredient_stock_nonnegative")
sa.CheckConstraint(Ingredient.min_stock >= 0, name="ck_ingredient_min_stock_nonnegative")
sa.CheckConstraint(Ingredient.reference_cost >= 0, name="ck_ingredient_cost_nonnegative")
sa.CheckConstraint(CashSession.initial_cash >= 0, name="ck_cash_initial_nonnegative")
sa.CheckConstraint(Payment.total_amount >= 0, name="ck_payment_total_nonnegative")
sa.CheckConstraint(Expense.amount > 0, name="ck_expense_amount_positive")

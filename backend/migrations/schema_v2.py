from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy.orm import DeclarativeBase, relationship


def utc_now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


user_roles = sa.Table(
    "user_roles",
    Base.metadata,
    sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), primary_key=True),
    sa.Column("role_id", sa.Integer, sa.ForeignKey("roles.id"), primary_key=True),
    sa.Column(
        "created_at", sa.DateTime(timezone=True), default=utc_now, nullable=False
    ),
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
    updated_at = sa.Column(
        sa.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    roles = relationship("Role", secondary=user_roles, back_populates="users")


role_permissions = sa.Table(
    "role_permissions",
    Base.metadata,
    sa.Column("role_id", sa.Integer, sa.ForeignKey("roles.id"), primary_key=True),
    sa.Column(
        "permission_id", sa.Integer, sa.ForeignKey("permissions.id"), primary_key=True
    ),
    sa.Column(
        "created_at", sa.DateTime(timezone=True), default=utc_now, nullable=False
    ),
)


class Role(Base):
    __tablename__ = "roles"

    id = sa.Column(sa.Integer, primary_key=True)
    name = sa.Column(sa.String(80), unique=True, nullable=False)
    description = sa.Column(sa.String(255), nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = sa.Column(
        sa.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    users = relationship("User", secondary=user_roles, back_populates="roles")
    permissions = relationship(
        "Permission", secondary=role_permissions, back_populates="roles"
    )


class Permission(Base):
    __tablename__ = "permissions"

    id = sa.Column(sa.Integer, primary_key=True)
    codename = sa.Column(sa.String(120), unique=True, nullable=False, index=True)
    description = sa.Column(sa.String(255), nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)

    roles = relationship(
        "Role", secondary=role_permissions, back_populates="permissions"
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = sa.Column(sa.Integer, primary_key=True)
    actor_user_id = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=True)
    target_user_id = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=True)
    action = sa.Column(sa.String(120), nullable=False)
    details = sa.Column(sa.JSON, nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)


class Category(Base):
    __tablename__ = "catalog_categories"

    id = sa.Column(sa.Integer, primary_key=True)
    name = sa.Column(sa.String(120), unique=True, nullable=False, index=True)
    description = sa.Column(sa.Text, nullable=True)
    is_active = sa.Column(sa.Boolean, nullable=False, default=True)
    display_order = sa.Column(sa.Integer, nullable=False, default=0)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = sa.Column(
        sa.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "catalog_products"

    id = sa.Column(sa.Integer, primary_key=True)
    internal_code = sa.Column(sa.String(80), unique=True, nullable=False, index=True)
    name = sa.Column(sa.String(160), nullable=False, index=True)
    description = sa.Column(sa.Text, nullable=False)
    current_price = sa.Column(sa.Numeric(12, 2), nullable=False)
    currency = sa.Column(
        sa.String(3), nullable=False, default="COP", server_default="COP"
    )
    price_version = sa.Column(sa.Integer, nullable=False, default=1, server_default="1")
    category_id = sa.Column(
        sa.Integer, sa.ForeignKey("catalog_categories.id"), nullable=False, index=True
    )
    recommended_people = sa.Column(sa.Integer, nullable=True)
    is_active = sa.Column(sa.Boolean, nullable=False, default=True, index=True)
    is_available = sa.Column(sa.Boolean, nullable=False, default=True, index=True)
    current_image_id = sa.Column(
        sa.Integer,
        sa.ForeignKey(
            "catalog_product_images.id", use_alter=True, name="fk_product_current_image"
        ),
        nullable=True,
    )
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = sa.Column(
        sa.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    category = relationship(
        "Category", back_populates="products", foreign_keys=[category_id]
    )
    images = relationship(
        "ProductImage", back_populates="product", foreign_keys="ProductImage.product_id"
    )
    price_history = relationship(
        "ProductPriceHistory",
        back_populates="product",
        order_by="ProductPriceHistory.changed_at.desc()",
    )
    current_image = relationship(
        "ProductImage", foreign_keys=[current_image_id], post_update=True
    )


class ProductImage(Base):
    __tablename__ = "catalog_product_images"

    id = sa.Column(sa.Integer, primary_key=True)
    product_id = sa.Column(
        sa.Integer, sa.ForeignKey("catalog_products.id"), nullable=False, index=True
    )
    file_reference = sa.Column(sa.String(500), nullable=False)
    is_current = sa.Column(sa.Boolean, nullable=False, default=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    replaced_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    uploaded_by = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=True)

    product = relationship(
        "Product", back_populates="images", foreign_keys=[product_id]
    )


class ProductPriceHistory(Base):
    __tablename__ = "catalog_product_price_history"

    id = sa.Column(sa.Integer, primary_key=True)
    product_id = sa.Column(
        sa.Integer, sa.ForeignKey("catalog_products.id"), nullable=False, index=True
    )
    previous_price = sa.Column(sa.Numeric(12, 2), nullable=True)
    new_price = sa.Column(sa.Numeric(12, 2), nullable=False)
    currency = sa.Column(
        sa.String(3), nullable=False, default="COP", server_default="COP"
    )
    price_version = sa.Column(sa.Integer, nullable=False, default=1)
    changed_by = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=False)
    changed_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)

    product = relationship("Product", back_populates="price_history")


class CatalogAuditEvent(Base):
    __tablename__ = "catalog_audit_events"

    id = sa.Column(sa.Integer, primary_key=True)
    actor_user_id = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=False)
    entity_type = sa.Column(sa.String(40), nullable=False)
    entity_id = sa.Column(sa.Integer, nullable=False)
    action = sa.Column(sa.String(80), nullable=False)
    details = sa.Column(sa.JSON, nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)


class DiningTable(Base):
    __tablename__ = "dining_tables"

    id = sa.Column(sa.Integer, primary_key=True)
    number = sa.Column(sa.String(30), unique=True, nullable=False)
    capacity = sa.Column(sa.Integer, nullable=False, default=4, server_default=sa.text("4"))
    is_active = sa.Column(sa.Boolean, nullable=False, default=True)
    state = sa.Column(sa.String(30), nullable=False, default="DISPONIBLE")
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = sa.Column(
        sa.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    sessions = relationship("TableSession", back_populates="table")


class TableSession(Base):
    __tablename__ = "table_sessions"

    id = sa.Column(sa.Integer, primary_key=True)
    table_id = sa.Column(
        sa.Integer, sa.ForeignKey("dining_tables.id"), nullable=False, index=True
    )
    waiter_id = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=False)
    people_count = sa.Column(sa.Integer, nullable=False)
    state = sa.Column(sa.String(30), nullable=False, default="OPEN")
    opened_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    closed_at = sa.Column(sa.DateTime(timezone=True), nullable=True)

    table = relationship("DiningTable", back_populates="sessions")
    orders = relationship("Order", back_populates="table_session")


class Order(Base):
    __tablename__ = "orders"

    id = sa.Column(sa.Integer, primary_key=True)
    table_session_id = sa.Column(
        sa.Integer, sa.ForeignKey("table_sessions.id"), nullable=False, index=True
    )
    waiter_id = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=False)
    state = sa.Column(sa.String(30), nullable=False, default="BORRADOR", index=True)
    account_requested = sa.Column(sa.Boolean, nullable=False, default=False)
    created_at = sa.Column(sa.DateTime(timezone=True), default=utc_now, nullable=False)
    confirmed_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    delivered_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    closed_at = sa.Column(sa.DateTime(timezone=True), nullable=True)

    table_session = relationship("TableSession", back_populates="orders")
    lines = relationship(
        "OrderLine", back_populates="order", cascade="all, delete-orphan"
    )
    cancellation = relationship(
        "OrderCancellation", back_populates="order", uselist=False
    )


class OrderLine(Base):
    __tablename__ = "order_lines"

    id = sa.Column(sa.Integer, primary_key=True)
    order_id = sa.Column(sa.Integer, sa.ForeignKey("orders.id"), nullable=False)
    product_id = sa.Column(sa.Integer, nullable=False)
    product_name = sa.Column(sa.String(160), nullable=False)
    unit_price = sa.Column(sa.Numeric(12, 2), nullable=False)
    quantity = sa.Column(sa.Integer, nullable=False)
    notes = sa.Column(sa.Text, nullable=True)

    order = relationship("Order", back_populates="lines")


class OrderCancellation(Base):
    __tablename__ = "order_cancellations"

    id = sa.Column(sa.Integer, primary_key=True)
    order_id = sa.Column(
        sa.Integer, sa.ForeignKey("orders.id"), unique=True, nullable=False
    )
    reason = sa.Column(sa.Text, nullable=False)
    cancelled_by = sa.Column(sa.Integer, sa.ForeignKey("users.id"), nullable=False)
    cancelled_at = sa.Column(
        sa.DateTime(timezone=True), default=utc_now, nullable=False
    )

    order = relationship("Order", back_populates="cancellation")


sa.Index(
    "uq_category_normalized_name",
    sa.func.lower(sa.func.trim(Category.name)),
    unique=True,
)
sa.Index(
    "uq_product_normalized_code",
    sa.func.upper(sa.func.trim(Product.internal_code)),
    unique=True,
)
sa.Index(
    "uq_open_table_session",
    TableSession.table_id,
    unique=True,
    postgresql_where=TableSession.state == "OPEN",
    sqlite_where=TableSession.state == "OPEN",
)
sa.Index(
    "uq_current_product_image",
    ProductImage.product_id,
    unique=True,
    postgresql_where=ProductImage.is_current.is_(True),
    sqlite_where=ProductImage.is_current.is_(True),
)
sa.UniqueConstraint(
    ProductPriceHistory.product_id,
    ProductPriceHistory.price_version,
    name="uq_price_history_version",
)
sa.CheckConstraint(Product.current_price >= 0, name="ck_product_price_nonnegative")
sa.CheckConstraint(Product.price_version > 0, name="ck_product_price_version")
sa.CheckConstraint(Product.currency == "COP", name="ck_product_currency")
sa.CheckConstraint(
    sa.or_(Product.recommended_people.is_(None), Product.recommended_people > 0),
    name="ck_product_people",
)

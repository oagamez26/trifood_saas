from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy import select, func, or_, update, delete
from sqlalchemy.orm import selectinload
from . import models as m
from ..shared.domain.rules import DomainError, now


def record(row):
    values = {
        column.name: getattr(row, column.name) for column in row.__table__.columns
    }
    return {
        key: str(value.quantize(Decimal(".01")))
        if isinstance(value, Decimal)
        else value
        for key, value in values.items()
    }


def get(session, model, identity, lock=False):
    query = select(model).where(model.id == identity)
    if lock:
        query = query.with_for_update()
    row = session.scalar(query.execution_options(populate_existing=True))
    if row is None:
        raise DomainError("NOT_FOUND", "El registro no existe.", 404)
    return row


def save(session, model, data, identity=None):
    row = get(session, model, identity) if identity else model()
    for key, value in data.items():
        setattr(row, key, value)
    session.add(row)
    session.flush()
    return row


# ==========================================
# AUTH & USERS REPOSITORY
# ==========================================

class AuthRepository:
    def __init__(self, session):
        self.session = session

    def lock_administration(self):
        pass

    def serialize_user(self, row):
        data = record(row)
        data["roles"] = [role.name for role in row.roles]
        data["effective_permissions"] = sorted(
            {p.codename for role in row.roles for p in role.permissions}
        )
        return data

    def user(self, user_id, lock=False):
        return self.serialize_user(get(self.session, m.User, user_id, lock))

    def find_user(self, lock=False, **filters):
        query = select(m.User).filter_by(**filters)
        if lock:
            query = query.with_for_update()
        row = self.session.scalar(query.execution_options(populate_existing=True))
        return self.serialize_user(row) if row else None

    def save_user(self, data, user_id=None):
        data = dict(data)
        roles = data.pop("roles", None)
        row = save(self.session, m.User, data, user_id)
        if roles is not None:
            selected = list(
                self.session.scalars(select(m.Role).where(m.Role.name.in_(roles)))
            )
            if len(selected) != len(set(roles)):
                raise DomainError(
                    "ROLE_NOT_FOUND", "Uno o más roles no existen.", 404
                )
            row.roles = selected
            self.session.flush()
        return self.serialize_user(row)

    def users(self):
        return [
            self.serialize_user(row)
            for row in self.session.scalars(
                select(m.User).order_by(m.User.last_name, m.User.id)
            )
        ]

    def serialize_role(self, row):
        return {
            **record(row),
            "permissions": [p.codename for p in row.permissions],
        }

    def roles(self):
        return [
            self.serialize_role(row)
            for row in self.session.scalars(
                select(m.Role).order_by(m.Role.name)
            )
        ]

    def role(self, role_id):
        return self.serialize_role(get(self.session, m.Role, role_id))

    def permissions(self):
        return [
            record(row)
            for row in self.session.scalars(
                select(m.Permission).order_by(m.Permission.codename)
            )
        ]

    def save_role(self, data, role_id=None):
        data = dict(data)
        permissions = data.pop("permissions", None)
        row = save(self.session, m.Role, data, role_id)
        if permissions is not None:
            values = list(
                self.session.scalars(
                    select(m.Permission).where(
                        m.Permission.codename.in_(permissions)
                    )
                )
            )
            if len(values) != len(set(permissions)):
                raise DomainError(
                    "PERMISSION_NOT_FOUND",
                    "Uno o más permisos no existen.",
                    404,
                )
            row.permissions = values
        self.session.flush()
        return self.serialize_role(row)

    def audit(self, action, actor_id=None, target_id=None, details=None):
        self.session.add(
            m.AuditEvent(
                action=action,
                actor_user_id=actor_id,
                target_user_id=target_id,
                details=details,
            )
        )
        self.session.flush()

    def events(self, action=None):
        query = select(m.AuditEvent).order_by(
            m.AuditEvent.created_at.desc(), m.AuditEvent.id.desc()
        )
        if action:
            query = query.where(m.AuditEvent.action == action)
        return [record(row) for row in self.session.scalars(query.limit(100))]


# ==========================================
# CATALOG REPOSITORY
# ==========================================

class CatalogRepository:
    def __init__(self, session):
        self.session = session

    def categories(self):
        return [
            record(row)
            for row in self.session.scalars(
                select(m.Category).order_by(
                    m.Category.display_order,
                    func.lower(m.Category.name),
                    m.Category.id,
                )
            )
        ]

    def category(self, category_id):
        return record(get(self.session, m.Category, category_id))

    def save_category(self, data, category_id=None):
        return record(save(self.session, m.Category, data, category_id))

    def serialize_product(self, row):
        data = record(row)
        data["current_price"] = str(row.current_price.quantize(Decimal(".01")))
        data["category"] = record(row.category) if row.category else None
        data["image_reference"] = (
            row.current_image.file_reference
            if row.current_image
            else "/media/products/default.svg"
        )
        return data

    def product(self, product_id):
        return self.serialize_product(get(self.session, m.Product, product_id))

    def products(
        self,
        q="",
        category_id=None,
        is_active=None,
        is_available=None,
        sort="name",
        direction="asc",
        page=1,
        page_size=25,
        public=False,
    ):
        query = select(m.Product).options(
            selectinload(m.Product.category),
            selectinload(m.Product.current_image),
        )
        if q:
            term = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            query = query.where(
                or_(
                    m.Product.name.ilike(f"%{term}%", escape="\\"),
                    m.Product.internal_code.ilike(f"%{term}%", escape="\\"),
                )
            )
        if category_id is not None:
            query = query.where(m.Product.category_id == category_id)
        if is_active is not None:
            query = query.where(m.Product.is_active == is_active)
        if is_available is not None:
            query = query.where(m.Product.is_available == is_available)
        if public:
            query = query.join(m.Category).where(
                m.Category.is_active.is_(True), m.Product.is_active.is_(True)
            )
        total = self.session.scalar(
            select(func.count()).select_from(query.subquery())
        )
        column = getattr(m.Product, sort)
        if sort == "name":
            column = func.lower(column)
        query = query.order_by(
            column.desc() if direction == "desc" else column.asc(),
            m.Product.id.asc(),
        )
        if not public:
            query = query.offset((page - 1) * page_size).limit(page_size)
        return {
            "items": [self.serialize_product(row) for row in self.session.scalars(query)],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    def save_product(self, data, product_id=None):
        return self.serialize_product(
            save(self.session, m.Product, data, product_id)
        )

    def add_history(self, product_id, previous, amount, version, actor_id):
        self.session.add(
            m.ProductPriceHistory(
                product_id=product_id,
                previous_price=previous,
                new_price=amount,
                changed_by=actor_id,
                price_version=version,
                currency="COP",
            )
        )
        self.session.flush()

    def change_price(self, product_id, amount, version, actor_id):
        product = self.product(product_id)
        if product["price_version"] != version:
            raise DomainError(
                "PRICE_CONFLICT",
                "El precio cambió. Recarga el precio vigente.",
                409,
            )
        if Decimal(product["current_price"]) == amount:
            locked = get(self.session, m.Product, product_id, lock=True)
            if locked.price_version != version:
                raise DomainError(
                    "PRICE_CONFLICT",
                    "El precio cambió. Recarga el precio vigente.",
                    409,
                )
            return self.serialize_product(locked)
        changed = self.session.execute(
            update(m.Product)
            .where(
                m.Product.id == product_id,
                m.Product.price_version == version,
            )
            .values(
                current_price=amount,
                price_version=version + 1,
                updated_at=now(),
            )
            .execution_options(synchronize_session=False)
        )
        if changed.rowcount != 1:
            raise DomainError(
                "PRICE_CONFLICT",
                "El precio cambió. Recarga el precio vigente.",
                409,
            )
        self.session.expire_all()
        self.add_history(
            product_id,
            Decimal(product["current_price"]),
            amount,
            version + 1,
            actor_id,
        )
        self.audit(
            "PRICE_CHANGED",
            actor_id,
            "product",
            product_id,
            {
                "previous_price": product["current_price"],
                "new_price": str(amount),
            },
        )
        return self.product(product_id)

    def history(self, product_id):
        self.product(product_id)
        return [
            record(row)
            for row in self.session.scalars(
                select(m.ProductPriceHistory)
                .where(m.ProductPriceHistory.product_id == product_id)
                .order_by(
                    m.ProductPriceHistory.changed_at.desc(),
                    m.ProductPriceHistory.id.desc(),
                )
            )
        ]

    def audit(self, action, actor_id, entity_type, entity_id, details=None):
        self.session.add(
            m.CatalogAuditEvent(
                action=action,
                actor_user_id=actor_id,
                entity_type=entity_type,
                entity_id=entity_id,
                details=details,
            )
        )
        self.session.flush()

    def events(self):
        return [
            record(row)
            for row in self.session.scalars(
                select(m.CatalogAuditEvent)
                .order_by(m.CatalogAuditEvent.id.desc())
                .limit(100)
            )
        ]

    def replace_image(self, product_id, reference, actor_id):
        product = get(self.session, m.Product, product_id, lock=True)
        self.session.execute(
            update(m.ProductImage)
            .where(
                m.ProductImage.product_id == product_id,
                m.ProductImage.is_current.is_(True),
            )
            .values(is_current=False, replaced_at=now())
        )
        if reference is not None:
            image = save(
                self.session,
                m.ProductImage,
                {
                    "product_id": product_id,
                    "file_reference": reference,
                    "uploaded_by": actor_id,
                    "is_current": True,
                },
            )
            product.current_image_id = image.id
        else:
            product.current_image_id = None
        self.session.flush()
        self.session.expire(product, ["current_image"])
        return self.serialize_product(product)



# ==========================================
# TABLES & ORDERS REPOSITORY
# ==========================================

class OrdersRepository:
    def __init__(self, session):
        self.session = session

    def tables(self):
        return [
            record(row)
            for row in self.session.scalars(
                select(m.DiningTable)
                .where(m.DiningTable.is_active == True)
                .order_by(m.DiningTable.number)
            )
        ]

    def table(self, table_id, lock=False):
        return record(get(self.session, m.DiningTable, table_id, lock))

    def save_table(self, data, table_id=None):
        return record(save(self.session, m.DiningTable, data, table_id))

    def delete_table(self, table_id):
        count = self.session.scalar(
            select(func.count(m.TableSession.id)).where(m.TableSession.table_id == table_id)
        )
        row = get(self.session, m.DiningTable, table_id)
        if count and count > 0:
            row.is_active = False
            return {"action": "deactivated", "id": table_id, "is_active": False}
        else:
            self.session.delete(row)
            return {"action": "deleted", "id": table_id}

    def session(self, session_id, lock=False):
        return record(get(self.session, m.TableSession, session_id, lock))

    def get_session(self, session_id, lock=False):
        return record(get(self.session, m.TableSession, session_id, lock))

    def session_data(self, row):
        return record(row)

    def get_table(self, table_id, lock=False):
        return record(get(self.session, m.DiningTable, table_id, lock))

    def get_order(self, order_id, lock=False):
        return self.serialize_order(get(self.session, m.Order, order_id, lock))

    def active_session(self, table_id):
        row = self.session.scalar(
            select(m.TableSession).where(
                m.TableSession.table_id == table_id,
                m.TableSession.state == "OPEN",
            )
        )
        return record(row) if row else None

    def save_session(self, data, session_id=None):
        return record(save(self.session, m.TableSession, data, session_id))

    def serialize_order(self, row):
        return {**record(row), "lines": [record(line) for line in row.lines]}

    def orders(self, session_id=None):
        query = select(m.Order).order_by(m.Order.id.desc())
        if session_id is not None:
            query = query.where(m.Order.table_session_id == session_id)
        return [self.serialize_order(row) for row in self.session.scalars(query)]

    def order(self, order_id, lock=False):
        return self.serialize_order(get(self.session, m.Order, order_id, lock))

    def save_order(self, data, lines=None, order_id=None):
        row = save(self.session, m.Order, data, order_id)
        if lines is not None:
            row.lines = [m.OrderLine(**line) for line in lines]
        self.session.flush()
        return self.serialize_order(row)

    def cancel(self, order_id, reason, actor_id):
        save(
            self.session,
            m.OrderCancellation,
            {"order_id": order_id, "reason": reason, "cancelled_by": actor_id},
        )


# ==========================================
# KITCHEN REPOSITORY
# ==========================================

class KitchenRepository:
    def __init__(self, session):
        self.session = session

    def queue(self):
        query = (
            select(m.Order)
            .where(
                m.Order.state.in_(
                    ["CONFIRMADO", "EN_COCINA", "EN_PREPARACION", "LISTO"]
                )
            )
            .order_by(m.Order.created_at.asc())
        )
        orders = self.session.scalars(query).all()
        result = []
        for o in orders:
            tbl_number = (
                o.table_session.table.number
                if o.table_session and o.table_session.table
                else "?"
            )
            result.append(
                {
                    **record(o),
                    "table_number": tbl_number,
                    "lines": [record(line) for line in o.lines],
                }
            )
        return result

    def deduct_order_inventory(self, order_or_id, actor_id):
        if isinstance(order_or_id, int):
            order = get(self.session, m.Order, order_or_id, lock=True)
        else:
            order = order_or_id
        if not order or getattr(order, "inventory_deducted", False):
            return

        required_by_ingredient = {}
        line_consumptions = []

        table_num = (
            order.table_session.table.number
            if order.table_session and order.table_session.table
            else str(order.table_session_id)
        )

        for line in order.lines:
            recipe = self.session.scalar(
                select(m.Recipe).where(m.Recipe.product_id == line.product_id)
            )
            if not recipe or not recipe.items:
                continue

            line_qty = Decimal(str(line.quantity))
            for item in recipe.items:
                item_qty = Decimal(str(item.quantity))
                consumption = (item_qty * line_qty).quantize(Decimal("0.0001"))
                required_by_ingredient[item.ingredient_id] = (
                    required_by_ingredient.get(item.ingredient_id, Decimal("0")) + consumption
                )
                line_consumptions.append((line, item, consumption))

        if not required_by_ingredient:
            order.inventory_deducted = True
            self.session.flush()
            return

        # Stock validation: verify all ingredients have sufficient stock
        for ing_id, total_needed in required_by_ingredient.items():
            ing = get(self.session, m.Ingredient, ing_id, lock=True)
            if ing.stock < total_needed:
                req_str = f"{total_needed.normalize():f}" if "." in str(total_needed) else str(total_needed)
                stock_str = f"{ing.stock.normalize():f}" if "." in str(ing.stock) else str(ing.stock)
                raise DomainError(
                    "INSUFFICIENT_STOCK",
                    f"Stock insuficiente para {ing.name}. Requerido: {req_str} {ing.base_unit}, disponible: {stock_str} {ing.base_unit}.",
                    409,
                )

        # Deduct and record movement & kardex
        for line, item, consumption in line_consumptions:
            ing = get(self.session, m.Ingredient, item.ingredient_id, lock=True)
            prev_stock = ing.stock
            new_stock = prev_stock - consumption
            ing.stock = new_stock
            ing.updated_at = now()

            ref = f"Comanda #{order.id} - Mesa {table_num} ({line.product_name} x{line.quantity})"

            mov = m.InventoryMovement(
                ingredient_id=ing.id,
                movement_type="CONSUMO_PREPARACION",
                quantity=consumption,
                previous_stock=prev_stock,
                new_stock=new_stock,
                reference=ref,
                responsible_user_id=actor_id,
            )
            self.session.add(mov)

            kardex = m.KardexEntry(
                ingredient_id=ing.id,
                movement_type="CONSUMO_PREPARACION",
                entry_quantity=Decimal("0"),
                exit_quantity=consumption,
                previous_balance=prev_stock,
                new_balance=new_stock,
                reference=ref,
                responsible_user_id=actor_id,
            )
            self.session.add(kardex)

        order.inventory_deducted = True
        self.session.flush()

    def update_state(self, order_id, new_state, actor_id):
        if new_state not in ("EN_PREPARACION", "LISTO"):
            raise DomainError(
                "OPERATION_NOT_ALLOWED",
                "Cocina solamente puede iniciar preparación o marcar pedidos como listos.",
                403,
            )
        order = get(self.session, m.Order, order_id, lock=True)
        if not getattr(order, "inventory_deducted", False):
            self.deduct_order_inventory(order, actor_id)
        order.state = new_state
        if new_state == "EN_PREPARACION":
            order.in_kitchen_at = now()
            if order.table_session and order.table_session.table:
                order.table_session.table.state = "EN_PREPARACION"
        elif new_state == "LISTO":
            order.ready_at = now()
            if order.table_session and order.table_session.table:
                order.table_session.table.state = "LISTO"
        self.session.flush()
        tbl_number = (
            order.table_session.table.number
            if order.table_session and order.table_session.table
            else "?"
        )
        return {
            **record(order),
            "table_number": tbl_number,
            "lines": [record(line) for line in order.lines],
        }


# ==========================================
# INGREDIENTS & INVENTORY REPOSITORY
# ==========================================

class InventoryRepository:
    def __init__(self, session):
        self.session = session

    def ingredients(self, active_only=False, search=None, stock_status=None, base_unit=None):
        query = select(m.Ingredient).order_by(m.Ingredient.name.asc())
        if active_only:
            query = query.where(m.Ingredient.is_active.is_(True))
        if search:
            term = f"%{search.strip().lower()}%"
            query = query.where(sa.func.lower(m.Ingredient.name).like(term))
        if base_unit and base_unit != "ALL":
            query = query.where(m.Ingredient.base_unit == base_unit)
        rows = list(self.session.scalars(query))
        if stock_status and stock_status != "ALL":
            s_up = stock_status.upper()
            if s_up in ("CRITICO", "CRÍTICO", "CRITICAL"):
                rows = [r for r in rows if r.stock <= 0]
            elif s_up in ("BAJO", "LOW"):
                rows = [r for r in rows if 0 < r.stock <= r.min_stock]
            elif s_up in ("NORMAL",):
                rows = [r for r in rows if r.stock > r.min_stock]
            elif s_up in ("INACTIVO", "INACTIVE"):
                rows = [r for r in rows if not r.is_active]
        return [record(row) for row in rows]

    def ingredient(self, ingredient_id, lock=False):
        return record(get(self.session, m.Ingredient, ingredient_id, lock))

    def save_ingredient(self, data, ingredient_id=None):
        return record(save(self.session, m.Ingredient, data, ingredient_id))

    def add_movement(
        self,
        ingredient_id,
        movement_type,
        quantity,
        responsible_id,
        reference=None,
    ):
        qty = Decimal(str(quantity))
        ing = get(self.session, m.Ingredient, ingredient_id, lock=True)
        prev_stock = ing.stock
        if movement_type in ("ENTRADA_MANUAL", "AJUSTE_POSITIVO", "REVERSION"):
            new_stock = prev_stock + qty
            entry_qty = qty
            exit_qty = Decimal("0")
        else:
            new_stock = prev_stock - qty
            entry_qty = Decimal("0")
            exit_qty = qty
            if new_stock < 0:
                raise DomainError(
                    "INSUFFICIENT_STOCK",
                    f"Stock insuficiente para {ing.name}. Disponible: {prev_stock} {ing.base_unit}, Requerido: {qty} {ing.base_unit}.",
                    409,
                )
        ing.stock = new_stock
        ing.updated_at = now()
        mov = m.InventoryMovement(
            ingredient_id=ingredient_id,
            movement_type=movement_type,
            quantity=qty,
            previous_stock=prev_stock,
            new_stock=new_stock,
            reference=reference,
            responsible_user_id=responsible_id,
        )
        self.session.add(mov)
        kardex = m.KardexEntry(
            ingredient_id=ingredient_id,
            movement_type=movement_type,
            entry_quantity=entry_qty,
            exit_quantity=exit_qty,
            previous_balance=prev_stock,
            new_balance=new_stock,
            reference=reference,
            responsible_user_id=responsible_id,
        )
        self.session.add(kardex)
        self.session.flush()
        return record(mov)

    def movements(self, ingredient_id=None, limit=100):
        query = select(m.InventoryMovement).order_by(
            m.InventoryMovement.created_at.desc(),
            m.InventoryMovement.id.desc(),
        )
        if ingredient_id:
            query = query.where(m.InventoryMovement.ingredient_id == ingredient_id)
        results = []
        for row in self.session.scalars(query.limit(limit)):
            ing_name = row.ingredient.name if row.ingredient else "?"
            unit = row.ingredient.base_unit if row.ingredient else ""
            resp_name = (
                f"{row.responsible_user.first_name} {row.responsible_user.last_name}"
                if row.responsible_user
                else "?"
            )
            results.append(
                {
                    **record(row),
                    "ingredient_name": ing_name,
                    "unit": unit,
                    "responsible_name": resp_name,
                    "actor_name": resp_name,
                }
            )
        return results

    def kardex(self, ingredient_id=None, movement_type=None, from_date=None, to_date=None, search=None, limit=500):
        query = select(m.KardexEntry).order_by(
            m.KardexEntry.created_at.desc(), m.KardexEntry.id.desc()
        )
        if ingredient_id:
            query = query.where(m.KardexEntry.ingredient_id == ingredient_id)
        if movement_type and movement_type != "ALL":
            query = query.where(m.KardexEntry.movement_type == movement_type)
        if from_date:
            query = query.where(m.KardexEntry.created_at >= from_date)
        if to_date:
            query = query.where(m.KardexEntry.created_at <= to_date)
        if search:
            term = f"%{search.strip().lower()}%"
            query = query.join(m.Ingredient).where(
                sa.or_(
                    sa.func.lower(m.Ingredient.name).like(term),
                    sa.func.lower(m.KardexEntry.reference).like(term),
                )
            )
        results = []
        for row in self.session.scalars(query.limit(limit)):
            ing_name = row.ingredient.name if row.ingredient else "?"
            unit = row.ingredient.base_unit if row.ingredient else ""
            resp_name = (
                f"{row.responsible_user.first_name} {row.responsible_user.last_name}"
                if row.responsible_user
                else "?"
            )
            qty = float(row.entry_quantity if row.entry_quantity > 0 else row.exit_quantity)
            ref_cost = float(row.ingredient.reference_cost) if row.ingredient and getattr(row.ingredient, "reference_cost", None) else 0.0
            results.append(
                {
                    **record(row),
                    "ingredient_name": ing_name,
                    "unit": unit,
                    "responsible_name": resp_name,
                    "actor_name": resp_name,
                    "balance_before": str(row.previous_balance),
                    "balance_after": str(row.new_balance),
                    "quantity": qty,
                    "unit_cost": ref_cost,
                    "reference": row.reference or "",
                }
            )
        return results


# ==========================================
# RECIPES REPOSITORY
# ==========================================

class RecipeRepository:
    def __init__(self, session):
        self.session = session

    def recipe_for_product(self, product_id):
        recipe = self.session.scalar(
            select(m.Recipe).where(m.Recipe.product_id == product_id)
        )
        if not recipe:
            return None
        return {
            **record(recipe),
            "items": [
                {
                    **record(item),
                    "ingredient_name": item.ingredient.name if item.ingredient else "?",
                    "ingredient_unit": item.ingredient.base_unit if item.ingredient else "?",
                    "reference_cost": str(item.ingredient.reference_cost) if item.ingredient else "0",
                }
                for item in recipe.items
            ],
        }

    def save_recipe(self, product_id, items_data, notes=None):
        recipe = self.session.scalar(
            select(m.Recipe).where(m.Recipe.product_id == product_id)
        )
        if not recipe:
            recipe = m.Recipe(product_id=product_id, notes=notes)
            self.session.add(recipe)
            self.session.flush()
        else:
            recipe.notes = notes
            self.session.execute(
                delete(m.RecipeItem).where(m.RecipeItem.recipe_id == recipe.id)
            )
        for it in items_data:
            self.session.add(
                m.RecipeItem(
                    recipe_id=recipe.id,
                    ingredient_id=it["ingredient_id"],
                    quantity=Decimal(str(it["quantity"])),
                    unit=it.get("unit", "g"),
                )
            )
        self.session.flush()
        return self.recipe_for_product(product_id)

    def calculate_capacity(self, product_id):
        recipe_data = self.recipe_for_product(product_id)
        if not recipe_data or not recipe_data["items"]:
            return {
                "capacity": 9999,
                "limiting_ingredient": None,
                "estimated_cost": "0.00",
            }
        min_capacity = 999999
        limiting_ing = None
        total_cost = Decimal("0.00")
        for item in recipe_data["items"]:
            ing = get(self.session, m.Ingredient, item["ingredient_id"])
            item_cost = (
                Decimal(str(item["quantity"])) * ing.reference_cost
            ).quantize(Decimal(".01"))
            total_cost += item_cost
            item_qty = Decimal(str(item["quantity"]))
            if item_qty > 0:
                possible = int(ing.stock // item_qty)
                if possible < min_capacity:
                    min_capacity = possible
                    limiting_ing = ing.name
        return {
            "capacity": max(0, min_capacity),
            "limiting_ingredient": limiting_ing,
            "estimated_cost": str(total_cost.quantize(Decimal(".01"))),
        }

    def all_recipes(self):
        products = self.session.scalars(select(m.Product).where(m.Product.is_active == True)).all()
        results = []
        for p in products:
            rec = self.recipe_for_product(p.id)
            cap = self.calculate_capacity(p.id)
            cost = Decimal(str(cap.get("estimated_cost", "0.00")))
            price = p.current_price
            margin = ((price - cost) / price * 100).quantize(Decimal(".1")) if price > 0 else Decimal("0")
            results.append({
                "product_id": p.id,
                "product_name": p.name,
                "sale_price": float(price),
                "cost": float(cost),
                "margin_percentage": float(margin),
                "capacity": cap.get("capacity", 0),
                "limiting_ingredient": cap.get("limiting_ingredient"),
                "notes": rec.get("notes") if rec else None,
                "items": [
                    {
                        "ingredient_id": it["ingredient_id"],
                        "ingredient_name": it["ingredient_name"],
                        "unit": it["ingredient_unit"],
                        "quantity": float(it["quantity"]),
                        "unit_cost": float(it["reference_cost"]),
                    }
                    for it in (rec["items"] if rec else [])
                ],
            })
        return results

    def deduct_for_order(self, order_id, actor_id):
        order = get(self.session, m.Order, order_id, lock=True)
        for line in order.lines:
            recipe = self.session.scalar(
                select(m.Recipe).where(m.Recipe.product_id == line.product_id)
            )
            if recipe:
                for item in recipe.items:
                    needed = item.quantity * Decimal(line.quantity)
                    ing = get(
                        self.session, m.Ingredient, item.ingredient_id, lock=True
                    )
                    prev_stock = ing.stock
                    new_stock = prev_stock - needed
                    ing.stock = new_stock
                    ing.updated_at = now()
                    self.session.add(
                        m.InventoryMovement(
                            ingredient_id=item.ingredient_id,
                            movement_type="CONSUMO_POR_PEDIDO",
                            quantity=needed,
                            previous_stock=prev_stock,
                            new_stock=new_stock,
                            reference=f"Pedido #{order.id} ({line.product_name} x{line.quantity})",
                            responsible_user_id=actor_id,
                        )
                    )
                    self.session.add(
                        m.KardexEntry(
                            ingredient_id=item.ingredient_id,
                            movement_type="CONSUMO_POR_PEDIDO",
                            entry_quantity=Decimal("0"),
                            exit_quantity=needed,
                            previous_balance=prev_stock,
                            new_balance=new_stock,
                            reference=f"Pedido #{order.id}",
                            responsible_user_id=actor_id,
                        )
                    )
        self.session.flush()


# ==========================================
# CASH REGISTERS REPOSITORY
# ==========================================

class CashRepository:
    def __init__(self, session):
        self.session = session

    def registers(self):
        regs = []
        for r in self.session.scalars(
            select(m.CashRegister).order_by(m.CashRegister.id)
        ):
            regs.append({
                **record(r),
                "active_session": self.active_session(r.id),
            })
        return regs

    def active_session(self, register_id=None):
        query = select(m.CashSession).where(m.CashSession.state == "OPEN")
        if register_id:
            query = query.where(m.CashSession.cash_register_id == register_id)
        row = self.session.scalar(query)
        if not row:
            return None
        return {
            **record(row),
            "cashier_name": f"{row.cashier.first_name} {row.cashier.last_name}"
            if row.cashier
            else "?",
            "register_name": row.cash_register.name
            if row.cash_register
            else "?",
        }

    def open_session(self, register_id, cashier_id, initial_cash):
        existing = self.active_session(register_id)
        if existing:
            raise DomainError(
                "SESSION_ALREADY_OPEN",
                "Ya existe una sesión abierta en esta caja.",
                409,
            )
        session = m.CashSession(
            cash_register_id=register_id,
            cashier_id=cashier_id,
            initial_cash=Decimal(str(initial_cash)),
            state="OPEN",
        )
        self.session.add(session)
        self.session.flush()
        return self.active_session(register_id)

    def close_session(self, session_id, reported_cash, notes=None):
        sess = get(self.session, m.CashSession, session_id, lock=True)
        if sess.state == "CLOSED":
            raise DomainError(
                "SESSION_ALREADY_CLOSED",
                "La sesión ya se encuentra cerrada.",
                409,
            )
        cash_payments = Decimal("0.00")
        sales_amt = Decimal("0.00")
        tips_amt = Decimal("0.00")
        total_col = Decimal("0.00")
        cash_col = Decimal("0.00")
        card_col = Decimal("0.00")
        trans_col = Decimal("0.00")

        for payment in sess.payments:
            p_cons = Decimal(str(getattr(payment, "consumption_amount", 0) or payment.total_amount))
            p_tip = Decimal(str(getattr(payment, "tip_amount", 0) or 0))
            p_tot = Decimal(str(payment.total_amount))

            sales_amt += p_cons
            tips_amt += p_tip
            total_col += p_tot

            for detail in payment.details:
                amt = Decimal(str(detail.amount))
                method = detail.payment_method.upper()
                if method in ("EFECTIVO", "CASH"):
                    cash_col += amt
                    cash_payments += amt
                elif method in ("TARJETA", "CARD", "DEBITO", "CREDITO"):
                    card_col += amt
                else:
                    trans_col += amt

        # Gastos asociados a este turno / caja
        sess_date = sess.opened_at.date() if hasattr(sess.opened_at, "date") else sess.opened_at
        expenses_query = select(m.Expense).where(m.Expense.expense_date >= sess_date)
        cash_expenses = sum(
            (Decimal(str(e.amount)) for e in self.session.scalars(expenses_query).all()),
            Decimal("0.00")
        )

        # Regla 14: Efectivo esperado = monto inicial + cobros reales en efectivo (sin tarjeta ni transferencia)
        expected = (sess.initial_cash + cash_payments).quantize(Decimal(".01"))
        rep = Decimal(str(reported_cash)).quantize(Decimal(".01"))
        diff = (rep - expected).quantize(Decimal(".01"))

        if diff == Decimal("0.00"):
            status = "CUADRADA"
        elif diff > Decimal("0.00"):
            status = "SOBRANTE"
        else:
            status = "FALTANTE"

        sess.sales_amount = sales_amt.quantize(Decimal(".01"))
        sess.tips_amount = tips_amt.quantize(Decimal(".01"))
        sess.total_collected = total_col.quantize(Decimal(".01"))
        sess.cash_collected = cash_col.quantize(Decimal(".01"))
        sess.card_collected = card_col.quantize(Decimal(".01"))
        sess.transfer_collected = trans_col.quantize(Decimal(".01"))
        sess.cash_expenses = cash_expenses.quantize(Decimal(".01"))
        sess.expected_cash = expected
        sess.reported_cash = rep
        sess.difference = diff
        sess.closure_status = status
        sess.notes = notes
        sess.state = "CLOSED"
        sess.closed_at = now()
        self.session.flush()
        return record(sess)

    def sessions_history(self, limit=50):
        query = select(m.CashSession).order_by(
            m.CashSession.opened_at.desc(), m.CashSession.id.desc()
        )
        results = []
        for s in self.session.scalars(query.limit(limit)):
            results.append(
                {
                    **record(s),
                    "cashier_name": f"{s.cashier.first_name} {s.cashier.last_name}"
                    if s.cashier
                    else "?",
                    "register_name": s.cash_register.name
                    if s.cash_register
                    else "?",
                }
            )
        return results


# ==========================================
# PAYMENTS & INVOICES REPOSITORY
# ==========================================

class PaymentRepository:
    def __init__(self, session):
        self.session = session

    def table_summary(self, table_id):
        table = get(self.session, m.DiningTable, table_id)
        sess = self.session.scalar(
            select(m.TableSession).where(
                m.TableSession.table_id == table_id,
                m.TableSession.state == "OPEN",
            )
        )
        if not sess:
            raise DomainError(
                "NO_ACTIVE_SESSION", "La mesa no tiene una sesión activa.", 404
            )
        orders = [order for order in sess.orders if order.state != "CANCELADO"]

        # Consultar facturas previas de la sesión para saber qué líneas ya fueron pagadas
        prev_invoices = self.session.scalars(
            select(m.Invoice).where(m.Invoice.table_session_id == sess.id)
        ).all()
        paid_qty_by_line = {}
        for inv in prev_invoices:
            for il in inv.lines:
                if il.order_line_id:
                    paid_qty_by_line[il.order_line_id] = paid_qty_by_line.get(il.order_line_id, 0) + il.quantity
                else:
                    k = f"{il.product_id}_{il.product_name}"
                    paid_qty_by_line[k] = paid_qty_by_line.get(k, 0) + il.quantity

        items = []
        total_consumption = Decimal("0.00")
        for o in orders:
            for l in o.lines:
                uprice = Decimal(str(l.unit_price))
                tot_qty = l.quantity
                tot_line = uprice * tot_qty
                total_consumption += tot_line

                paid_qty = paid_qty_by_line.get(l.id, 0)
                if not paid_qty:
                    paid_qty = paid_qty_by_line.get(f"{l.product_id}_{l.product_name}", 0)
                paid_qty = min(tot_qty, paid_qty)

                pending_qty = max(0, tot_qty - paid_qty)

                items.append({
                    "order_line_id": l.id,
                    "order_id": o.id,
                    "product_id": l.product_id,
                    "name": l.product_name,
                    "unit_price": str(uprice),
                    "ordered_qty": tot_qty,
                    "paid_qty": paid_qty,
                    "pending_qty": pending_qty,
                    "subtotal": str(tot_line.quantize(Decimal(".01"))),
                    "pending_subtotal": str((uprice * pending_qty).quantize(Decimal(".01"))),
                })

        # Consultar historial real de pagos de la sesión
        prev_payments = self.session.scalars(
            select(m.Payment)
            .where(m.Payment.table_session_id == sess.id)
            .order_by(m.Payment.created_at.asc(), m.Payment.id.asc())
        ).all()

        total_paid_consumption = sum(
            (Decimal(str(p.consumption_amount or p.total_amount)) for p in prev_payments),
            Decimal("0.00"),
        )
        pending_balance = max(Decimal("0.00"), total_consumption - total_paid_consumption)

        payments_history = []
        for idx, p in enumerate(prev_payments, 1):
            c_name = f"{p.cashier.first_name} {p.cashier.last_name}" if getattr(p, "cashier", None) else "Cajero"
            dt = p.created_at
            methods_list = [d.payment_method for d in p.details]
            methods_summary = ", ".join(sorted(set(methods_list))) if methods_list else "EFECTIVO"
            payments_history.append({
                "id": p.id,
                "number": idx,
                "created_at": dt.isoformat() if dt else "",
                "time": dt.strftime("%H:%M") if dt else "",
                "consumption_amount": str(p.consumption_amount.quantize(Decimal(".01")) if p.consumption_amount else p.total_amount),
                "tip_amount": str(p.tip_amount.quantize(Decimal(".01")) if p.tip_amount else Decimal("0.00")),
                "total_amount": str(p.total_amount.quantize(Decimal(".01"))),
                "payment_method": methods_summary,
                "cashier_name": c_name,
                "cash_received": str(p.cash_received.quantize(Decimal(".01"))) if p.cash_received else None,
                "cash_change": str(p.cash_change.quantize(Decimal(".01"))) if p.cash_change else None,
                "details": [
                    {
                        "method": d.payment_method,
                        "amount": str(d.amount.quantize(Decimal(".01"))),
                        "reference_code": d.reference_code,
                    }
                    for d in p.details
                ],
            })

        is_already_partial = (table.state == "PAGO_PARCIAL")
        account_requested = any(getattr(o, "account_requested", False) for o in orders) or (table.state == "CUENTA_SOLICITADA")
        all_delivered = all(o.state in ("ENTREGADO", "PAGADO", "CERRADO") for o in orders) if orders else False
        is_billable = is_already_partial or (all_delivered and account_requested and pending_balance > Decimal("0.00"))

        return {
            "table_id": table.id,
            "table_number": table.number,
            "session_id": sess.id,
            "waiter_name": f"{sess.waiter.first_name} {sess.waiter.last_name}" if getattr(sess, "waiter", None) else "Mesero",
            "state": table.state,
            "opened_at": sess.opened_at.isoformat(),
            "orders_count": len(orders),
            "orders": [
                {
                    "id": o.id,
                    "state": o.state,
                    "account_requested": getattr(o, "account_requested", False),
                    "lines": [
                        {
                            "order_line_id": l.id,
                            "name": l.product_name,
                            "qty": l.quantity,
                            "unit_price": str(l.unit_price),
                            "subtotal": str((l.unit_price * l.quantity).quantize(Decimal(".01"))),
                        }
                        for l in o.lines
                    ],
                }
                for o in orders
            ],
            "items": items,
            "payments_history": payments_history,
            "total_amount": str(total_consumption.quantize(Decimal(".01"))),
            "total_paid": str(total_paid_consumption.quantize(Decimal(".01"))),
            "pending_balance": str(pending_balance.quantize(Decimal(".01"))),
            "is_billable": is_billable,
            "account_requested": account_requested,
            "all_delivered": all_delivered,
        }

    def process_payment(
        self,
        table_session_id,
        cash_session_id,
        cashier_id,
        details,
        items=None,
        custom_amount=None,
        tip_amount=0,
        cash_received=None,
    ):
        sess = get(self.session, m.TableSession, table_session_id, lock=True)
        if sess.state == "CLOSED":
            raise DomainError(
                "ALREADY_PAID", "Esta cuenta ya fue cobrada y cerrada.", 409
            )
        cash_sess = get(self.session, m.CashSession, cash_session_id)
        if cash_sess.state != "OPEN":
            raise DomainError(
                "CASH_REGISTER_CLOSED",
                "La sesión de caja seleccionada no está abierta.",
                409,
            )
        orders = [o for o in sess.orders if o.state != "CANCELADO"]
        if not orders:
            raise DomainError(
                "EMPTY_ORDERS", "No hay pedidos válidos para cobrar.", 422
            )

        # Regla 5: La mesa solamente puede cobrarse si los pedidos están entregados y la cuenta fue solicitada,
        # o si la mesa ya tiene un pago parcial previo.
        tbl = sess.table
        is_already_partial = (tbl.state == "PAGO_PARCIAL")
        account_is_requested = any(getattr(o, "account_requested", False) for o in orders) or (tbl.state == "CUENTA_SOLICITADA")
        all_delivered = all(o.state in ("ENTREGADO", "PAGADO", "CERRADO") for o in orders)

        if not is_already_partial:
            if not all_delivered:
                raise DomainError(
                    "ORDER_NOT_DELIVERED",
                    "No se puede cobrar la mesa; los pedidos deben estar entregados al cliente primero.",
                    409,
                )
            if not account_is_requested:
                raise DomainError(
                    "ACCOUNT_NOT_REQUESTED",
                    "No se puede cobrar la mesa; el mesero debe solicitar la cuenta primero.",
                    409,
                )

        # Calcular consumo total de la comanda y lo ya pagado
        total_session_consumption = sum(
            (Decimal(str(l.unit_price)) * l.quantity for o in orders for l in o.lines),
            Decimal("0.00"),
        )
        all_session_payments = self.session.scalars(
            select(m.Payment).where(m.Payment.table_session_id == sess.id)
        ).all()
        total_session_paid = sum(
            (Decimal(str(p.consumption_amount or p.total_amount)) for p in all_session_payments),
            Decimal("0.00"),
        )
        current_pending_balance = max(Decimal("0.00"), total_session_consumption - total_session_paid)

        if current_pending_balance <= Decimal("0.00"):
            raise DomainError("ALREADY_PAID", "La cuenta ya no tiene saldo pendiente por cobrar.", 409)

        # Consultar facturas previas para calcular cantidades pendientes por ítem
        prev_invoices = self.session.scalars(
            select(m.Invoice).where(m.Invoice.table_session_id == sess.id)
        ).all()
        paid_qty_by_line = {}
        for inv in prev_invoices:
            for il in inv.lines:
                if il.order_line_id:
                    paid_qty_by_line[il.order_line_id] = paid_qty_by_line.get(il.order_line_id, 0) + il.quantity
                else:
                    k = f"{il.product_id}_{il.product_name}"
                    paid_qty_by_line[k] = paid_qty_by_line.get(k, 0) + il.quantity

        all_lines_map = {}
        for o in orders:
            for l in o.lines:
                all_lines_map[l.id] = l

        lines_to_charge = []
        is_free_abono = False

        if items:
            # Opción 1: Cobro parcial por productos y cantidades específicas
            consumption_to_pay = Decimal("0.00")
            for it in items:
                line_id = it.get("order_line_id")
                qty = int(it.get("quantity", 0))
                if qty <= 0:
                    continue
                if line_id not in all_lines_map:
                    raise DomainError("INVALID_ITEM", f"La línea #{line_id} no pertenece a esta mesa.", 422)
                line = all_lines_map[line_id]
                already_paid = paid_qty_by_line.get(line.id, 0)
                pending_units = line.quantity - already_paid
                if qty > pending_units:
                    raise DomainError(
                        "QUANTITY_EXCEEDED",
                        f"Cantidad a cobrar ({qty}) excede las unidades pendientes ({pending_units}) de {line.product_name}.",
                        422,
                    )
                uprice = Decimal(str(line.unit_price))
                consumption_to_pay += uprice * qty
                lines_to_charge.append((line, qty))
        elif custom_amount is not None:
            # Opción 2: Abono libre por valor (ej: $20.000, $35.500)
            is_free_abono = True
            consumption_to_pay = Decimal(str(custom_amount)).quantize(Decimal(".01"))
            if consumption_to_pay <= Decimal("0.00"):
                raise DomainError("ZERO_AMOUNT", "El valor del abono debe ser superior a cero.", 422)
            if consumption_to_pay > current_pending_balance:
                raise DomainError(
                    "AMOUNT_EXCEEDS_BALANCE",
                    f"El valor a abonar (${consumption_to_pay}) excede el saldo pendiente (${current_pending_balance}).",
                    422,
                )
        else:
            # Opción 3: Cobro total del saldo pendiente restante
            consumption_to_pay = current_pending_balance
            for o in orders:
                for l in o.lines:
                    already_paid = paid_qty_by_line.get(l.id, 0)
                    if not already_paid:
                        already_paid = paid_qty_by_line.get(f"{l.product_id}_{l.product_name}", 0)
                    pending_units = max(0, l.quantity - already_paid)
                    if pending_units > 0:
                        lines_to_charge.append((l, pending_units))

        consumption_to_pay = consumption_to_pay.quantize(Decimal(".01"))
        tip = Decimal(str(tip_amount or 0)).quantize(Decimal(".01"))
        total_to_pay = (consumption_to_pay + tip).quantize(Decimal(".01"))

        if total_to_pay <= Decimal("0.00"):
            raise DomainError("ZERO_AMOUNT", "El saldo a pagar es cero o no hay productos seleccionados.", 422)

        # Normalizar medios de pago: exclusivamente EFECTIVO, TARJETA, TRANSFERENCIA
        norm_details = []
        for d in details:
            m_str = str(d.get("payment_method", "EFECTIVO")).upper()
            if m_str in ("NEQUI", "DAVIPLATA", "TRANSFERENCIA", "BANCOLOMBIA"):
                clean_method = "TRANSFERENCIA"
            elif m_str in ("TARJETA", "CARD", "DEBITO", "CREDITO", "DATAFONO"):
                clean_method = "TARJETA"
            else:
                clean_method = "EFECTIVO"
            norm_details.append({
                "payment_method": clean_method,
                "amount": Decimal(str(d["amount"])).quantize(Decimal(".01")),
                "reference_code": d.get("reference_code"),
            })

        paid_total = sum(d["amount"] for d in norm_details).quantize(Decimal(".01"))
        if paid_total != total_to_pay:
            raise DomainError(
                "AMOUNT_MISMATCH",
                f"El total pagado (${paid_total}) no coincide con el total a pagar (${total_to_pay}) [Consumo: ${consumption_to_pay} + Propina: ${tip}].",
                422,
            )

        cash_part = sum(d["amount"] for d in norm_details if d["payment_method"] == "EFECTIVO")
        cash_change = None
        if cash_received is not None:
            cash_rec = Decimal(str(cash_received)).quantize(Decimal(".01"))
            if cash_rec < cash_part:
                raise DomainError(
                    "INSUFFICIENT_CASH",
                    f"Efectivo recibido (${cash_rec}) es menor al monto cobrado en efectivo (${cash_part}).",
                    422,
                )
            cash_change = (cash_rec - cash_part).quantize(Decimal(".01"))

        # Registrar pago en DB
        payment = m.Payment(
            table_session_id=table_session_id,
            cash_session_id=cash_session_id,
            cashier_id=cashier_id,
            consumption_amount=consumption_to_pay,
            tip_amount=tip,
            total_amount=total_to_pay,
            cash_received=Decimal(str(cash_received)).quantize(Decimal(".01")) if cash_received is not None else None,
            cash_change=cash_change,
        )
        self.session.add(payment)
        self.session.flush()

        for d in norm_details:
            self.session.add(
                m.PaymentDetail(
                    payment_id=payment.id,
                    payment_method=d["payment_method"],
                    amount=d["amount"],
                    reference_code=d.get("reference_code"),
                )
            )

        # Generar Factura / Comprobante
        inv_count = self.session.scalar(select(func.count(m.Invoice.id))) + 1
        inv_number = f"FAC-{inv_count:06d}"
        methods_str = ", ".join(sorted(set(d["payment_method"] for d in norm_details)))
        table = sess.table

        invoice = m.Invoice(
            invoice_number=inv_number,
            payment_id=payment.id,
            table_session_id=sess.id,
            cashier_id=cashier_id,
            waiter_id=sess.waiter_id,
            table_number=table.number,
            subtotal=consumption_to_pay,
            tip=tip,
            tax=Decimal("0.00"),
            total=total_to_pay,
            payment_method_summary=methods_str,
        )
        self.session.add(invoice)
        self.session.flush()

        if is_free_abono:
            self.session.add(
                m.InvoiceLine(
                    invoice_id=invoice.id,
                    order_line_id=None,
                    product_id=0,
                    product_name=f"Abono parcial a cuenta - Mesa {table.number}",
                    quantity=1,
                    unit_price=consumption_to_pay,
                    subtotal=consumption_to_pay,
                )
            )
        else:
            for l, qty in lines_to_charge:
                uprice = Decimal(str(l.unit_price))
                self.session.add(
                    m.InvoiceLine(
                        invoice_id=invoice.id,
                        order_line_id=l.id,
                        product_id=l.product_id,
                        product_name=l.product_name,
                        quantity=qty,
                        unit_price=uprice,
                        subtotal=(uprice * qty).quantize(Decimal(".01")),
                    )
                )
        self.session.flush()

        # Recalcular saldo total pendiente tras este nuevo pago
        new_total_paid = total_session_paid + consumption_to_pay
        remaining_balance = max(Decimal("0.00"), total_session_consumption - new_total_paid)

        if remaining_balance <= Decimal("0.00"):
            sess.state = "CLOSED"
            sess.closed_at = now()
            table.state = "DISPONIBLE"
            for order in orders:
                order.state = "PAGADO"
        else:
            table.state = "PAGO_PARCIAL"

        self.session.flush()

        return {
            "payment_id": payment.id,
            "invoice_number": inv_number,
            "invoice_id": invoice.id,
            "total": str(total_to_pay),
            "consumption": str(consumption_to_pay),
            "tip": str(tip),
            "cash_change": str(cash_change) if cash_change is not None else None,
            "remaining_balance": str(remaining_balance.quantize(Decimal(".01"))),
            "is_fully_paid": (remaining_balance <= Decimal("0.00")),
            "table_state": table.state,
        }


class InvoiceRepository:
    def __init__(self, session):
        self.session = session

    def invoices(self, limit=100):
        query = select(m.Invoice).order_by(
            m.Invoice.created_at.desc(), m.Invoice.id.desc()
        )
        return [
            {
                **record(inv),
                "cashier_name": f"{inv.cashier.first_name} {inv.cashier.last_name}"
                if inv.cashier
                else "?",
                "waiter_name": f"{inv.waiter.first_name} {inv.waiter.last_name}"
                if inv.waiter
                else "?",
            }
            for inv in self.session.scalars(query.limit(limit))
        ]

    def invoice(self, invoice_id):
        inv = get(self.session, m.Invoice, invoice_id)
        return {
            **record(inv),
            "cashier_name": f"{inv.cashier.first_name} {inv.cashier.last_name}"
            if inv.cashier
            else "?",
            "waiter_name": f"{inv.waiter.first_name} {inv.waiter.last_name}"
            if inv.waiter
            else "?",
            "lines": [record(line) for line in inv.lines],
        }


# ==========================================
# EXPENSES REPOSITORY
# ==========================================

class ExpenseRepository:
    def __init__(self, session):
        self.session = session

    def categories(self):
        return [
            record(c)
            for c in self.session.scalars(
                select(m.ExpenseCategory).order_by(m.ExpenseCategory.name)
            )
        ]

    def save_category(self, name, description=None):
        return record(
            save(self.session, m.ExpenseCategory, {"name": name, "description": description})
        )

    def expenses(self, category_id=None, limit=100):
        query = select(m.Expense).order_by(
            m.Expense.expense_date.desc(), m.Expense.id.desc()
        )
        if category_id:
            query = query.where(m.Expense.category_id == category_id)
        results = []
        for e in self.session.scalars(query.limit(limit)):
            cat_name = e.category.name if e.category else "?"
            resp_name = (
                f"{e.responsible_user.first_name} {e.responsible_user.last_name}"
                if e.responsible_user
                else "?"
            )
            results.append(
                {
                    **record(e),
                    "category_name": cat_name,
                    "responsible_name": resp_name,
                }
            )
        return results

    def save_expense(self, data):
        return record(save(self.session, m.Expense, data))


# ==========================================
# SETTINGS REPOSITORY
# ==========================================

class SettingsRepository:
    def __init__(self, session):
        self.session = session

    def all(self):
        settings = self.session.scalars(select(m.RestaurantSetting)).all()
        return {s.key: s.value for s in settings}

    def get(self, key, default=None):
        s = self.session.scalar(
            select(m.RestaurantSetting).where(m.RestaurantSetting.key == key)
        )
        return s.value if s else default

    def set(self, key, value, description=None):
        s = self.session.scalar(
            select(m.RestaurantSetting).where(m.RestaurantSetting.key == key)
        )
        if s:
            s.value = str(value)
            s.updated_at = now()
            if description:
                s.description = description
        else:
            s = m.RestaurantSetting(
                key=key, value=str(value), description=description
            )
            self.session.add(s)
        self.session.flush()
        return {s.key: s.value}


# ==========================================
# PREDICTIONS & REPORTS REPOSITORY
# ==========================================

class PredictionsRepository:
    def __init__(self, session):
        self.session = session

    def alerts(self, target_weekday=None, safety_margin=Decimal("1.20")):
        if target_weekday is None:
            target_weekday = datetime.now().weekday()
        products = self.session.scalars(
            select(m.Product).where(m.Product.is_active.is_(True))
        ).all()
        alerts = []
        for p in products:
            rec = self.session.scalar(
                select(m.Recipe).where(m.Recipe.product_id == p.id)
            )
            if not rec or not rec.items:
                continue
            min_capacity = 999999
            limiting_ing = None
            for it in rec.items:
                ing = it.ingredient
                if it.quantity > 0:
                    poss = int(ing.stock // it.quantity)
                    if poss < min_capacity:
                        min_capacity = poss
                        limiting_ing = ing.name
            capacity = max(0, min_capacity)
            demand_history = self.session.scalars(
                select(m.OrderLine.quantity)
                .join(m.Order)
                .where(
                    m.OrderLine.product_id == p.id,
                    m.Order.state != "CANCELADO",
                )
            ).all()
            total_sold = sum(demand_history)
            estimated_demand = int(
                Decimal(str(max(6, total_sold // 3 if total_sold else 6)))
                * safety_margin
            )
            deficit = max(0, estimated_demand - capacity)
            if not demand_history or total_sold < 2:
                status = "DATOS_INSUFICIENTES"
            elif capacity >= estimated_demand:
                status = "SIN_RIESGO"
            elif capacity < int(estimated_demand * Decimal("0.5")):
                status = "RIESGO_ALTO"
            else:
                status = "RIESGO_MEDIO"
            days_es = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
            day_name = days_es[target_weekday % 7]
            alerts.append(
                {
                    "product_id": p.id,
                    "product_name": p.name,
                    "day_of_week": day_name,
                    "capacity": capacity,
                    "current_capacity": capacity,
                    "estimated_demand": estimated_demand,
                    "deficit": deficit,
                    "projected_deficit": deficit,
                    "limiting_ingredient": limiting_ing,
                    "status": status,
                    "risk_level": status,
                    "recommendation": f"Se sugiere reabastecer {deficit} porciones de {limiting_ing or 'insumos'}."
                    if deficit > 0
                    else "Capacidad suficiente para la demanda proyectada.",
                }
            )
        return alerts


class ReportsRepository:
    def __init__(self, session):
        self.session = session

    def sales_summary(self, from_date=None, to_date=None):
        query = select(m.Payment)
        if from_date:
            query = query.where(m.Payment.created_at >= from_date)
        if to_date:
            query = query.where(m.Payment.created_at <= to_date)
        payments = self.session.scalars(query).all()

        total_consumption = Decimal("0.00")
        total_tips = Decimal("0.00")
        total_sales = Decimal("0.00")
        orders_count = len(payments)

        methods = {"EFECTIVO": Decimal("0.00"), "TARJETA": Decimal("0.00"), "TRANSFERENCIA": Decimal("0.00")}
        methods_count = {"EFECTIVO": 0, "TARJETA": 0, "TRANSFERENCIA": 0}
        for p in payments:
            cons = Decimal(str(getattr(p, "consumption_amount", 0) or p.total_amount))
            tip = Decimal(str(getattr(p, "tip_amount", 0) or 0))
            tot = Decimal(str(p.total_amount))
            total_consumption += cons
            total_tips += tip
            total_sales += tot

            for d in p.details:
                amt = Decimal(str(d.amount))
                m_str = d.payment_method.upper()
                if m_str in ("EFECTIVO", "CASH"):
                    methods["EFECTIVO"] += amt
                    methods_count["EFECTIVO"] += 1
                elif m_str in ("TARJETA", "CARD", "DEBITO", "CREDITO"):
                    methods["TARJETA"] += amt
                    methods_count["TARJETA"] += 1
                else:
                    methods["TRANSFERENCIA"] += amt
                    methods_count["TRANSFERENCIA"] += 1

        ticket_avg = (
            (total_sales / orders_count).quantize(Decimal(".01"))
            if orders_count
            else Decimal("0.00")
        )

        return {
            "total_sales": str(total_sales.quantize(Decimal(".01"))),
            "total_consumption": str(total_consumption.quantize(Decimal(".01"))),
            "total_tips": str(total_tips.quantize(Decimal(".01"))),
            "orders_count": orders_count,
            "ticket_average": str(ticket_avg),
            "methods_breakdown": {
                k: str(v.quantize(Decimal(".01"))) for k, v in methods.items()
            },
            "methods_count": methods_count,
        }

    def operating_result(self, from_date=None, to_date=None):
        pay_query = select(m.Payment)
        if from_date:
            pay_query = pay_query.where(m.Payment.created_at >= from_date)
        if to_date:
            pay_query = pay_query.where(m.Payment.created_at <= to_date)
        payments = self.session.scalars(pay_query).all()

        total_sales = sum(
            (Decimal(str(p.total_amount)) for p in payments),
            Decimal("0.00"),
        )
        total_cogs = Decimal("0.00")

        lines_query = (
            select(m.OrderLine)
            .join(m.Order)
            .where(m.Order.state != "CANCELADO")
        )
        if from_date:
            lines_query = lines_query.where(m.Order.created_at >= from_date)
        if to_date:
            lines_query = lines_query.where(m.Order.created_at <= to_date)
        lines = self.session.scalars(lines_query).all()

        for line in lines:
            recipe = self.session.scalar(
                select(m.Recipe).where(m.Recipe.product_id == line.product_id)
            )
            if recipe:
                for it in recipe.items:
                    total_cogs += (
                        it.quantity
                        * Decimal(line.quantity)
                        * it.ingredient.reference_cost
                    )
        gross_margin = total_sales - total_cogs

        exp_query = select(m.Expense)
        if from_date:
            f_d_only = from_date.date() if hasattr(from_date, "date") else from_date
            exp_query = exp_query.where(m.Expense.expense_date >= f_d_only)
        if to_date:
            t_d_only = to_date.date() if hasattr(to_date, "date") else to_date
            exp_query = exp_query.where(m.Expense.expense_date <= t_d_only)
        expenses = self.session.scalars(exp_query).all()
        total_expenses = sum(
            (Decimal(str(e.amount)) for e in expenses),
            Decimal("0.00"),
        )
        operating_result = gross_margin - total_expenses

        return {
            "total_sales": str(total_sales.quantize(Decimal(".01"))),
            "estimated_cogs": str(total_cogs.quantize(Decimal(".01"))),
            "estimated_gross_margin": str(gross_margin.quantize(Decimal(".01"))),
            "total_expenses": str(total_expenses.quantize(Decimal(".01"))),
            "estimated_operating_result": str(
                operating_result.quantize(Decimal(".01"))
            ),
        }


# ==========================================
# SQL UNIT OF WORK
# ==========================================

class SqlUnitOfWork:
    def __init__(self, session):
        self.session = session
        self.auth = AuthRepository(session)
        self.catalog = CatalogRepository(session)
        self.orders = OrdersRepository(session)
        self.kitchen = KitchenRepository(session)
        self.inventory = InventoryRepository(session)
        self.recipes = RecipeRepository(session)
        self.cash = CashRepository(session)
        self.payments = PaymentRepository(session)
        self.invoices = InvoiceRepository(session)
        self.expenses = ExpenseRepository(session)
        self.settings = SettingsRepository(session)
        self.predictions = PredictionsRepository(session)
        self.reports = ReportsRepository(session)

    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()

    def close(self):
        self.session.close()

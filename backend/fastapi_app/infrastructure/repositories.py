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
                select(m.DiningTable).order_by(m.DiningTable.number)
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

    def update_state(self, order_id, new_state, actor_id):
        order = get(self.session, m.Order, order_id, lock=True)
        order.state = new_state
        if new_state == "EN_PREPARACION":
            order.in_kitchen_at = now()
        elif new_state == "LISTO":
            order.ready_at = now()
        elif new_state == "ENTREGADO":
            order.delivered_at = now()
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

    def ingredients(self, active_only=False):
        query = select(m.Ingredient).order_by(m.Ingredient.name.asc())
        if active_only:
            query = query.where(m.Ingredient.is_active.is_(True))
        return [record(row) for row in self.session.scalars(query)]

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

    def kardex(self, ingredient_id=None, limit=200):
        query = select(m.KardexEntry).order_by(
            m.KardexEntry.created_at.desc(), m.KardexEntry.id.desc()
        )
        if ingredient_id:
            query = query.where(m.KardexEntry.ingredient_id == ingredient_id)
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
        for payment in sess.payments:
            for detail in payment.details:
                if detail.payment_method == "EFECTIVO":
                    cash_payments += detail.amount
        expected = sess.initial_cash + cash_payments
        rep = Decimal(str(reported_cash))
        diff = rep - expected
        if diff == 0:
            status = "CUADRADA"
        elif diff > 0:
            status = "SOBRANTE"
        else:
            status = "FALTANTE"
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
        total = sum(
            sum(
                Decimal(str(line.unit_price)) * line.quantity
                for line in order.lines
            )
            for order in orders
        )
        return {
            "table_id": table.id,
            "table_number": table.number,
            "session_id": sess.id,
            "opened_at": sess.opened_at.isoformat(),
            "orders_count": len(orders),
            "orders": [
                {
                    "id": o.id,
                    "state": o.state,
                    "lines": [
                        {
                            "name": l.product_name,
                            "qty": l.quantity,
                            "unit_price": str(l.unit_price),
                            "subtotal": str(
                                (l.unit_price * l.quantity).quantize(
                                    Decimal(".01")
                                )
                            ),
                        }
                        for l in o.lines
                    ],
                }
                for o in orders
            ],
            "total_amount": str(total.quantize(Decimal(".01"))),
        }

    def process_payment(
        self,
        table_session_id,
        cash_session_id,
        cashier_id,
        details,
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
        total = sum(
            sum(
                Decimal(str(line.unit_price)) * line.quantity
                for line in order.lines
            )
            for order in orders
        ).quantize(Decimal(".01"))
        paid_total = sum(Decimal(str(d["amount"])) for d in details).quantize(
            Decimal(".01")
        )
        if paid_total != total:
            raise DomainError(
                "AMOUNT_MISMATCH",
                f"El total pagado ({paid_total}) no coincide con el total de la cuenta ({total}).",
                422,
            )
        cash_change = None
        if cash_received is not None:
            cash_rec = Decimal(str(cash_received))
            cash_part = sum(
                Decimal(str(d["amount"]))
                for d in details
                if d["payment_method"] == "EFECTIVO"
            )
            if cash_rec < cash_part:
                raise DomainError(
                    "INSUFFICIENT_CASH",
                    f"Efectivo recibido ({cash_rec}) es menor al monto en efectivo ({cash_part}).",
                    422,
                )
            cash_change = (cash_rec - cash_part).quantize(Decimal(".01"))

        payment = m.Payment(
            table_session_id=table_session_id,
            cash_session_id=cash_session_id,
            cashier_id=cashier_id,
            total_amount=total,
            cash_received=Decimal(str(cash_received))
            if cash_received
            else None,
            cash_change=cash_change,
        )
        self.session.add(payment)
        self.session.flush()

        for d in details:
            self.session.add(
                m.PaymentDetail(
                    payment_id=payment.id,
                    payment_method=d["payment_method"],
                    amount=Decimal(str(d["amount"])),
                    reference_code=d.get("reference_code"),
                )
            )

        sess.state = "CLOSED"
        sess.closed_at = now()
        table = sess.table
        table.state = "DISPONIBLE"

        inv_count = self.session.scalar(select(func.count(m.Invoice.id))) + 1
        inv_number = f"FAC-{inv_count:06d}"
        methods_str = ", ".join(d["payment_method"] for d in details)
        invoice = m.Invoice(
            invoice_number=inv_number,
            payment_id=payment.id,
            table_session_id=sess.id,
            cashier_id=cashier_id,
            waiter_id=sess.waiter_id,
            table_number=table.number,
            subtotal=total,
            tax=Decimal("0.00"),
            total=total,
            payment_method_summary=methods_str,
        )
        self.session.add(invoice)
        self.session.flush()

        for order in orders:
            for line in order.lines:
                self.session.add(
                    m.InvoiceLine(
                        invoice_id=invoice.id,
                        product_id=line.product_id,
                        product_name=line.product_name,
                        quantity=line.quantity,
                        unit_price=line.unit_price,
                        subtotal=(line.unit_price * line.quantity).quantize(
                            Decimal(".01")
                        ),
                    )
                )
        self.session.flush()
        return {
            "payment_id": payment.id,
            "invoice_number": inv_number,
            "invoice_id": invoice.id,
            "total": str(total),
            "cash_change": str(cash_change) if cash_change is not None else None,
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
            alerts.append(
                {
                    "product_id": p.id,
                    "product_name": p.name,
                    "capacity": capacity,
                    "estimated_demand": estimated_demand,
                    "deficit": deficit,
                    "limiting_ingredient": limiting_ing,
                    "status": status,
                    "recommendation": f"Se sugiere reabastecer {deficit} porciones de {limiting_ing or 'insumos'}."
                    if deficit > 0
                    else "Capacidad suficiente.",
                }
            )
        return alerts


class ReportsRepository:
    def __init__(self, session):
        self.session = session

    def sales_summary(self):
        payments = self.session.scalars(select(m.Payment)).all()
        total_sales = sum(p.total_amount for p in payments)
        orders_count = len(payments)
        ticket_avg = (
            (total_sales / orders_count).quantize(Decimal(".01"))
            if orders_count
            else Decimal("0.00")
        )
        methods = {}
        for p in payments:
            for d in p.details:
                methods[d.payment_method] = (
                    methods.get(d.payment_method, Decimal("0.00")) + d.amount
                )
        return {
            "total_sales": str(total_sales.quantize(Decimal(".01"))),
            "orders_count": orders_count,
            "ticket_average": str(ticket_avg),
            "methods_breakdown": {
                k: str(v.quantize(Decimal(".01"))) for k, v in methods.items()
            },
        }

    def operating_result(self):
        payments = self.session.scalars(select(m.Payment)).all()
        total_sales = sum(p.total_amount for p in payments)
        total_cogs = Decimal("0.00")
        lines = self.session.scalars(
            select(m.OrderLine)
            .join(m.Order)
            .where(m.Order.state != "CANCELADO")
        ).all()
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
        expenses = self.session.scalars(select(m.Expense)).all()
        total_expenses = sum(e.amount for e in expenses)
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

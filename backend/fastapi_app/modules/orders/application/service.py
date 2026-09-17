from ....shared.application.ports import UnitOfWork
from ....shared.domain.rules import (
    DomainError,
    require,
    text,
    positive_integer,
    now,
    transition,
)


class OrdersService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    def tables(self, actor):
        require(actor, "table.view")
        values = self.uow.orders.tables()
        for table in values:
            table["active_session"] = self.uow.orders.active_session(table["id"])
        return values

    def create_table(self, actor, number, capacity=4):
        require(actor, "table.create")
        payload = {
            "number": text(number, 30),
            "capacity": positive_integer(capacity or 4),
            "is_active": True,
            "state": "DISPONIBLE",
        }
        result = self.uow.orders.save_table(payload)
        self.uow.auth.audit(
            "TABLE_CREATED", actor["id"], details={"table_id": result["id"], "number": number}
        )
        self.uow.commit()
        return result

    def update_table(self, actor, identity, data):
        require(actor, "table.update")
        table = self.uow.orders.table(identity, lock=True)
        if not table:
            raise DomainError("TABLE_NOT_FOUND", "Mesa no encontrada.", 404)
        payload = {}
        if "number" in data and data["number"]:
            payload["number"] = text(data["number"], 30)
        if "capacity" in data and data["capacity"]:
            payload["capacity"] = positive_integer(data["capacity"])
        if "is_active" in data and data["is_active"] is not None:
            if not data["is_active"] and self.uow.orders.active_session(identity):
                raise DomainError(
                    "TABLE_BUSY", "No se puede inactivar una mesa con servicio abierto.", 409
                )
            payload["is_active"] = bool(data["is_active"])
        result = self.uow.orders.save_table(payload, identity)
        self.uow.auth.audit(
            "TABLE_UPDATED", actor["id"], details={"table_id": identity, "data": data}
        )
        self.uow.commit()
        return result

    def delete_table(self, actor, identity):
        require(actor, "table.update")
        table = self.uow.orders.table(identity, lock=True)
        if not table:
            raise DomainError("TABLE_NOT_FOUND", "Mesa no encontrada.", 404)
        if self.uow.orders.active_session(identity):
            raise DomainError(
                "TABLE_BUSY", "No se puede eliminar una mesa con servicio abierto.", 409
            )
        result = self.uow.orders.delete_table(identity)
        self.uow.auth.audit(
            "TABLE_DELETED", actor["id"], details={"table_id": identity, "result": result}
        )
        self.uow.commit()
        return result

    def open_table(self, actor, identity, people):
        require(actor, "table.open")
        table = self.uow.orders.table(identity, lock=True)
        if (
            not table["is_active"]
            or table["state"] != "DISPONIBLE"
            or self.uow.orders.active_session(identity)
        ):
            raise DomainError("TABLE_NOT_AVAILABLE", "La mesa no está disponible.", 409)
        session = self.uow.orders.save_session(
            {
                "table_id": identity,
                "waiter_id": actor["id"],
                "people_count": positive_integer(people),
            }
        )
        self.uow.orders.save_table({"state": "SIN_PEDIDO"}, identity)
        self.uow.auth.audit("TABLE_OPENED", actor["id"], details={"table_id": identity})
        self.uow.commit()
        return session

    def close_table(self, actor, identity):
        require(actor, "table.close")
        self.uow.orders.table(identity, lock=True)
        session = self.uow.orders.active_session(identity)
        if not session:
            raise DomainError("SESSION_NOT_OPEN", "No hay una cuenta activa.", 409)
        self.uow.orders.get_session(session["id"], lock=True)
        if any(
            o["state"] not in {"PAGADO", "CERRADO", "CANCELADO"}
            for o in self.uow.orders.orders(session["id"])
        ):
            raise DomainError(
                "TABLE_NOT_READY",
                "Hay pedidos pendientes; no se puede cerrar la mesa.",
                409,
            )
        self.uow.orders.save_session(
            {"state": "CLOSED", "closed_at": now()}, session["id"]
        )
        result = self.uow.orders.save_table({"state": "DISPONIBLE"}, identity)
        self.uow.auth.audit("TABLE_CLOSED", actor["id"], details={"table_id": identity})
        self.uow.commit()
        return result

    def request_account(self, actor, identity):
        require(actor, "table.view")
        self.uow.orders.table(identity, lock=True)
        session = self.uow.orders.active_session(identity)
        if not session:
            raise DomainError("SESSION_NOT_OPEN", "La mesa no tiene una cuenta activa.", 409)
        orders = [o for o in self.uow.orders.orders(session["id"]) if o.get("state") != "CANCELADO"]
        if not orders:
            raise DomainError("NO_ORDERS", "La mesa no tiene pedidos para solicitar cuenta.", 422)
        if any(o.get("state") not in ("ENTREGADO", "PAGADO", "CERRADO") for o in orders):
            raise DomainError(
                "ORDER_NOT_DELIVERED",
                "No se puede solicitar la cuenta; todos los pedidos deben estar entregados al cliente.",
                409,
            )
        for o in orders:
            self.uow.orders.save_order({"account_requested": True}, None, o["id"])
        result = self.uow.orders.save_table({"state": "CUENTA_SOLICITADA"}, identity)
        self.uow.auth.audit(
            "ACCOUNT_REQUESTED", actor["id"], details={"table_id": identity, "session_id": session["id"]}
        )
        self.uow.commit()
        return result

    def validated_lines(self, lines):
        if not lines:
            raise DomainError("INVALID_ORDER", "Agrega al menos un producto.")
        result = []
        for line in lines:
            p = self.uow.catalog.product(line["product_id"])
            if (
                not p["is_active"]
                or not p["is_available"]
                or not p["category"]["is_active"]
            ):
                raise DomainError(
                    "PRODUCT_NOT_AVAILABLE", "Un producto no está disponible.", 409
                )
            result.append(
                {
                    "product_id": p["id"],
                    "product_name": p["name"],
                    "unit_price": p["current_price"],
                    "quantity": positive_integer(line["quantity"]),
                    "notes": line.get("notes"),
                }
            )
        return result

    def create_order(self, actor, session_id, lines):
        require(actor, "order.create")
        session = self.uow.orders.get_session(session_id, lock=True)
        if session["state"] != "OPEN":
            raise DomainError("SESSION_NOT_OPEN", "La cuenta no está abierta.", 409)
        existing_orders = self.uow.orders.orders(session_id)
        if any(o.get("state") not in ("CANCELADO", "PAGADO", "CERRADO") for o in existing_orders):
            raise DomainError(
                "ORDER_ALREADY_EXISTS",
                "Esta mesa ya tiene una comanda activa. Debe modificar el pedido existente.",
                409,
            )
        result = self.uow.orders.save_order(
            {"table_session_id": session_id, "waiter_id": actor["id"], "state": "BORRADOR"},
            self.validated_lines(lines),
        )
        if session.get("table_id"):
            self.uow.orders.save_table({"state": "PENDIENTE"}, session["table_id"])
        self.uow.auth.audit(
            "ORDER_CREATED", actor["id"], details={"order_id": result["id"]}
        )
        self.uow.commit()
        return result

    def list_orders(self, actor, session_id=None):
        require(actor, "order.view")
        return self.uow.orders.orders(session_id)

    def get_order(self, actor, identity):
        require(actor, "order.view")
        return self.uow.orders.order(identity)

    def update_draft(self, actor, identity, lines):
        require(actor, "order.update_draft")
        order = self.uow.orders.order(identity, lock=True)
        if order["state"] in ("EN_PREPARACION", "LISTO", "ENTREGADO", "PAGADO", "CERRADO", "CANCELADO"):
            raise DomainError(
                "ORDER_LOCKED",
                "No se puede modificar el pedido; ya se encuentra en preparación o finalizado.",
                409,
            )
        result = self.uow.orders.save_order({}, self.validated_lines(lines), identity)
        self.uow.auth.audit(
            "ORDER_UPDATED", actor["id"], details={"order_id": identity}
        )
        self.uow.commit()
        return result

    def change_state(self, actor, identity, target, reason=None):
        permission = {
            "CONFIRMADO": "order.confirm",
            "CANCELADO": "order.cancel",
            "ENTREGADO": "order.deliver",
            "EN_COCINA": "order.confirm",
            "EN_PREPARACION": "order.prepare",
            "LISTO": "order.prepare",
        }[target]
        require(actor, permission)
        order = self.uow.orders.order(identity, lock=True)
        transition(order["state"], target)
        values = {"state": target}
        lines = None
        if target == "CONFIRMADO":
            lines = self.validated_lines(order["lines"])
            values["confirmed_at"] = now()
            if order.get("table_session_id"):
                sess = self.uow.orders.get_session(order["table_session_id"])
                if sess and sess.get("table_id"):
                    self.uow.orders.save_table({"state": "PENDIENTE"}, sess["table_id"])
        if target in ("EN_PREPARACION", "LISTO"):
            if hasattr(self.uow, "kitchen"):
                self.uow.kitchen.deduct_order_inventory(identity, actor["id"])
            if target == "EN_PREPARACION":
                values["in_kitchen_at"] = now()
                if order.get("table_session_id"):
                    sess = self.uow.orders.get_session(order["table_session_id"])
                    if sess and sess.get("table_id"):
                        self.uow.orders.save_table({"state": "EN_PREPARACION"}, sess["table_id"])
            elif target == "LISTO":
                values["ready_at"] = now()
                if order.get("table_session_id"):
                    sess = self.uow.orders.get_session(order["table_session_id"])
                    if sess and sess.get("table_id"):
                        self.uow.orders.save_table({"state": "LISTO"}, sess["table_id"])
        if target == "ENTREGADO":
            values["delivered_at"] = now()
            if order.get("table_session_id"):
                sess = self.uow.orders.get_session(order["table_session_id"])
                if sess and sess.get("table_id"):
                    self.uow.orders.save_table({"state": "ENTREGADO"}, sess["table_id"])
        if target == "CANCELADO":
            self.uow.orders.cancel(identity, text(reason, 2000), actor["id"])
        result = self.uow.orders.save_order(values, lines, identity)
        self.uow.auth.audit(
            "ORDER_" + target, actor["id"], details={"order_id": identity}
        )
        self.uow.commit()
        return result

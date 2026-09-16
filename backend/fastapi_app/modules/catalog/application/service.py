from ....shared.application.ports import UnitOfWork
from ....shared.domain.rules import DomainError, require, money, positive_integer, text


class CatalogService:
    def __init__(self, uow: UnitOfWork, images=None):
        self.uow, self.images = uow, images

    def categories(self, actor):
        require(actor, "category.view")
        return self.uow.catalog.categories()

    def category(self, actor, identity):
        require(actor, "category.view")
        return self.uow.catalog.category(identity)

    def save_category(self, actor, data, identity=None, action=None):
        permission = (
            "category.disable"
            if action == "deactivate"
            else "category.update"
            if identity
            else "category.create"
        )
        require(actor, permission)
        data = dict(data)
        if "name" in data:
            data["name"] = text(data["name"], 120)
        if action:
            data = {"is_active": action == "activate"}
        result = self.uow.catalog.save_category(data, identity)
        self.uow.catalog.audit(
            "CATEGORY_" + (action or ("UPDATED" if identity else "CREATED")).upper(),
            actor["id"],
            "category",
            result["id"],
        )
        self.uow.commit()
        return result

    def products(self, actor, **filters):
        require(actor, "product.view")
        return self.uow.catalog.products(**filters)

    def product(self, actor, identity):
        require(actor, "product.view")
        return self.uow.catalog.product(identity)

    def save_product(self, actor, data, identity=None):
        require(actor, "product.update" if identity else "product.create")
        data = dict(data)
        if "internal_code" in data:
            data["internal_code"] = text(data["internal_code"], 80).upper()
        if "name" in data:
            data["name"] = text(data["name"], 160)
        if "description" in data:
            data["description"] = text(data["description"], 10000)
        if "recommended_people" in data:
            data["recommended_people"] = positive_integer(
                data["recommended_people"], True
            )
        if "category_id" in data:
            unchanged = (
                identity is not None
                and self.uow.catalog.product(identity)["category_id"]
                == data["category_id"]
            )
            if (
                not unchanged
                and not self.uow.catalog.category(data["category_id"])["is_active"]
            ):
                raise DomainError(
                    "CATEGORY_INACTIVE", "La categoría está inactiva.", 409
                )
        if not identity:
            data["current_price"] = money(data["current_price"])
        result = self.uow.catalog.save_product(data, identity)
        if not identity:
            self.uow.catalog.add_history(
                result["id"], None, data["current_price"], 1, actor["id"]
            )
        self.uow.catalog.audit(
            "PRODUCT_UPDATED" if identity else "PRODUCT_CREATED",
            actor["id"],
            "product",
            result["id"],
        )
        self.uow.commit()
        return result

    def state(self, actor, identity, action, available=None):
        permission = (
            "product.change_availability"
            if action == "availability"
            else "product.disable"
            if action == "deactivate"
            else "product.update"
        )
        require(actor, permission)
        data = (
            {"is_available": available}
            if action == "availability"
            else {"is_active": action == "activate"}
        )
        result = self.uow.catalog.save_product(data, identity)
        self.uow.catalog.audit(action.upper(), actor["id"], "product", identity)
        self.uow.commit()
        return result

    def price(self, actor, identity, amount, version):
        require(actor, "product.change_price")
        result = self.uow.catalog.change_price(
            identity, money(amount), version, actor["id"]
        )
        self.uow.commit()
        return result

    def history(self, actor, identity, page=1, page_size=25):
        require(actor, "product.view")
        items = self.uow.catalog.history(identity)
        return {
            "items": items[(page - 1) * page_size : page * page_size],
            "total": len(items),
            "page": page,
            "page_size": page_size,
        }

    def public_menu(self):
        products = self.uow.catalog.products(public=True)["items"]
        categories = []
        for category in self.uow.catalog.categories():
            selected = []
            for p in products:
                if p["category_id"] == category["id"]:
                    selected.append(
                        {
                            key: p[key]
                            for key in (
                                "name",
                                "description",
                                "current_price",
                                "currency",
                                "recommended_people",
                                "is_available",
                                "image_reference",
                            )
                        }
                    )
                    selected[-1]["category_name"] = category["name"]


            if category["is_active"] and selected:
                categories.append({"name": category["name"], "products": selected})
        return {"currency": "COP", "categories": categories}

    def image(self, actor, identity, content):
        require(actor, "product.update")
        self.uow.catalog.product(identity)
        if content is None:
            result = self.uow.catalog.replace_image(identity, None, actor["id"])
            self.uow.catalog.audit("IMAGE_REMOVED", actor["id"], "product", identity)
            self.uow.commit()
            return result
        reference = self.images.store(content)
        try:
            result = self.uow.catalog.replace_image(identity, reference, actor["id"])
            self.uow.catalog.audit("IMAGE_CHANGED", actor["id"], "product", identity)
            self.uow.commit()
            return result
        except Exception:
            self.uow.rollback()
            self.images.remove(reference)
            raise


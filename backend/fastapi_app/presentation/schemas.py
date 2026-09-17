from decimal import Decimal
from typing import Annotated, Literal
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    AliasChoices,
    field_validator,
)


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Login(Input):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=128)
    model_config = ConfigDict(extra="forbid")  # Password whitespace is meaningful.


class PasswordChange(Input):
    current_password: str
    new_password: str
    model_config = ConfigDict(extra="forbid")


class ResetRequest(Input):
    email: str = Field(min_length=3, max_length=255)


class ResetConfirm(Input):
    token: str = Field(min_length=1, max_length=256)
    new_password: str
    model_config = ConfigDict(extra="forbid")


class UserCreate(Input):
    model_config = ConfigDict(extra="forbid")  # Preserve the supplied password exactly.
    username: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=255)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=128)
    roles: list[str] = []
    is_active: StrictBool = True
    must_change_password: StrictBool = False


class UserUpdate(Input):
    email: str | None = Field(default=None, min_length=3, max_length=255)
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    is_active: StrictBool | None = None
    roles: list[str] | None = None

    @field_validator("email", "first_name", "last_name", "is_active", "roles")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("Este campo no puede ser nulo.")
        return value



class RoleAssign(Input):
    role: str = Field(min_length=1, max_length=80)


class RoleUpdate(Input):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = None
    permissions: list[str] | None = None

    @field_validator("name", "permissions")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("Este campo no puede ser nulo.")
        return value


class CategoryCreate(Input):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    display_order: StrictInt = Field(default=0, ge=0)


class CategoryUpdate(Input):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    display_order: StrictInt | None = Field(default=None, ge=0)

    @field_validator("name", "display_order")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("Este campo no puede ser nulo.")
        return value


Price = Annotated[
    Decimal, Field(ge=0, max_digits=12, decimal_places=2, allow_inf_nan=False)
]


class ProductCreate(Input):
    internal_code: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=10000)
    current_price: Price = Field(
        validation_alias=AliasChoices("current_price", "price")
    )
    category_id: StrictInt = Field(gt=0)
    recommended_people: StrictInt | None = Field(default=None, gt=0)


class ProductUpdate(Input):
    internal_code: str | None = Field(default=None, min_length=1, max_length=80)
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, min_length=1, max_length=10000)
    category_id: StrictInt | None = Field(default=None, gt=0)
    recommended_people: StrictInt | None = Field(default=None, gt=0)

    @field_validator("internal_code", "name", "description", "category_id")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("Este campo no puede ser nulo.")
        return value


class PriceChange(Input):
    current_price: Price = Field(
        validation_alias=AliasChoices("current_price", "price")
    )
    expected_price_version: StrictInt = Field(gt=0)


class Availability(Input):
    is_available: StrictBool


class TableCreate(Input):
    number: str = Field(min_length=1, max_length=30)
    capacity: StrictInt = Field(default=4, gt=0, le=50)


class TableUpdate(Input):
    number: str | None = Field(default=None, min_length=1, max_length=30)
    capacity: StrictInt | None = Field(default=None, gt=0, le=50)
    is_active: StrictBool | None = None


class TableOpen(Input):
    people_count: StrictInt = Field(gt=0)


class OrderLine(Input):
    product_id: StrictInt = Field(gt=0)
    quantity: StrictInt = Field(gt=0)
    notes: str | None = Field(default=None, max_length=2000)


class OrderCreate(Input):
    table_session_id: StrictInt = Field(gt=0)
    notes: str | None = Field(default=None, max_length=2000)
    lines: list[OrderLine] = Field(min_length=1, max_length=100)


class OrderUpdate(Input):
    lines: list[OrderLine] = Field(min_length=1, max_length=100)


class Cancellation(Input):
    reason: str = Field(min_length=1, max_length=2000)


class PublicProduct(BaseModel):
    name: str
    description: str
    current_price: str
    currency: Literal["COP"]
    category_name: str
    recommended_people: int | None
    is_available: bool
    image_reference: str




class PublicCategory(BaseModel):
    name: str
    products: list[PublicProduct]


class PublicMenu(BaseModel):
    currency: Literal["COP"]
    categories: list[PublicCategory]

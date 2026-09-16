from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, AliasChoices
from .dependencies import get_current_user, get_uow
from ..shared.domain.rules import require

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


class ExpenseCategoryIn(BaseModel):
    name: str
    description: Optional[str] = None


class ExpenseIn(BaseModel):
    category_id: int
    concept: str = Field(validation_alias=AliasChoices("concept", "description"))
    amount: float
    expense_date: Optional[date] = None
    incurred_at: Optional[str] = None
    notes: Optional[str] = None
    is_fixed: Optional[bool] = False


@router.get("/categories")
def list_expense_categories(user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "expense.view")
    return uow.expenses.categories()


@router.post("/categories")
def create_expense_category(data: ExpenseCategoryIn, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "expense.create")
    res = uow.expenses.save_category(data.name, data.description)
    uow.commit()
    return res


@router.get("")
@router.get("/")
def list_expenses(category_id: Optional[int] = None, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "expense.view")
    return uow.expenses.expenses(category_id=category_id)


@router.post("")
@router.post("/")
def create_expense(data: ExpenseIn, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "expense.create")
    exp_date = data.expense_date
    if not exp_date:
        if data.incurred_at:
            exp_date = date.fromisoformat(data.incurred_at[:10])
        else:
            exp_date = date.today()
    expense_dict = {
        "category_id": data.category_id,
        "concept": data.concept,
        "amount": data.amount,
        "expense_date": exp_date,
        "notes": data.notes,
        "responsible_user_id": user["id"],
    }
    res = uow.expenses.save_expense(expense_dict)
    uow.commit()
    return res

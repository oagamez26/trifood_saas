from typing import Dict, Any
from fastapi import APIRouter, Depends
from .dependencies import get_current_user, get_uow
from ..shared.domain.rules import require

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
def get_settings(user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "settings.view")
    return uow.settings.all()


@router.put("")
def update_settings(data: Dict[str, Any], user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "settings.update")
    for k, v in data.items():
        uow.settings.set(k, v)
    uow.commit()
    return uow.settings.all()

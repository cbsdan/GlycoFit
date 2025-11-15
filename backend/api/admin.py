from fastapi import APIRouter
from models.user import User

router = APIRouter()

@router.get("/admin/users")
def get_all_users():
    users = User.get_all_users()
    return [user.to_admin_dict() for user in users]

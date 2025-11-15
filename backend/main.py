from fastapi import FastAPI
from routes.admin import router as admin_router

app = FastAPI()

# Include the admin router
app.include_router(admin_router)

# ...existing code...
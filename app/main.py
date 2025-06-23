# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api import api_router

app = FastAPI(title="Camera Control API", version="1.0")

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/projects", StaticFiles(directory="projects"), name="projects")

# API routes (your existing endpoints)
app.include_router(api_router)

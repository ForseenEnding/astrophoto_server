from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api import api_router

app = FastAPI(title="Camera Control API", version="1.0")

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router)

# Static file serving for projects and captures
app.mount("/projects", StaticFiles(directory="projects"), name="projects")

# Serve built frontend (this should be last)
app.mount("/", StaticFiles(directory="static", html=True), name="frontend")

#!/usr/bin/env python3
"""
Minimal backend server to test if basic connectivity works
"""

import sys
import os
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

app = FastAPI(title="Simple Backend Test")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Simple health check"""
    return {
        "status": "healthy",
        "message": "Backend server is running",
        "port": 8000
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Backend server is working!"}

if __name__ == "__main__":
    print("🚀 Starting simple backend test server on http://localhost:8000")
    print("   Health check: http://localhost:8000/health")
    print("   Press Ctrl+C to stop")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
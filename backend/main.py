from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.data import router as data_router
from backend.api.experiment import router as experiment_router
from backend.api.llm import router as llm_router


app = FastAPI(title="ML Experiment Lab API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(llm_router)
app.include_router(data_router)
app.include_router(experiment_router)


@app.get("/")
def root():
    return {
        "message": "ML Experiment Lab backend is running"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "backend"
    }
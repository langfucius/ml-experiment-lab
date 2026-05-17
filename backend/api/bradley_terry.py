from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.bradley_terry_service import (
    BradleyTerryError,
    run_bradley_terry_benchmark,
)
from backend.services.data_service import DataServiceError
from backend.services.experiment_runner import ExperimentError


router = APIRouter(prefix="/api/bradley-terry", tags=["Bradley-Terry"])


class BradleyTerryRunRequest(BaseModel):
    dataset_id: str
    target_column: str
    task_type: Literal["classification", "regression"]
    model_names: list[str] = Field(default_factory=list)

    metric: str

    dynamic_variable: str = Field(default="label_noise_rate")
    start: float = Field(default=0.0)
    end: float = Field(default=0.4)
    steps: int = Field(default=8, ge=2, le=30)

    test_size: float = Field(default=0.2, ge=0.05, le=0.8)
    random_state: int = Field(default=42)


class BradleyTerryRunResponse(BaseModel):
    dataset_id: str
    target_column: str
    task_type: str
    model_names: list[str]
    metric: str
    dynamic_variable: str
    values: list[float]
    win_matrix: dict[str, dict[str, int]]
    ranking: list[dict[str, Any]]
    experiment_rows: list[dict[str, Any]]


@router.post("/run", response_model=BradleyTerryRunResponse)
def run_bradley_terry_api(payload: BradleyTerryRunRequest):
    try:
        return run_bradley_terry_benchmark(
            dataset_id=payload.dataset_id,
            target_column=payload.target_column,
            task_type=payload.task_type,
            model_names=payload.model_names,
            metric=payload.metric,
            dynamic_variable=payload.dynamic_variable,
            start=payload.start,
            end=payload.end,
            steps=payload.steps,
            test_size=payload.test_size,
            random_state=payload.random_state,
        )

    except (BradleyTerryError, DataServiceError, ExperimentError) as e:
        raise HTTPException(status_code=400, detail=str(e))
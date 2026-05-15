from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.data_service import DataServiceError, get_dataset
from backend.services.experiment_runner import ExperimentError, run_experiment


router = APIRouter(prefix="/api/experiment", tags=["Experiment"])


class ExperimentRunRequest(BaseModel):
    dataset_id: str
    target_column: str
    task_type: Literal["classification", "regression"]
    model_names: list[str] = Field(default_factory=list)
    test_size: float = Field(default=0.2, ge=0.05, le=0.8)
    random_state: int = Field(default=42)


class ExperimentRunResponse(BaseModel):
    dataset_id: str
    target_column: str
    task_type: str
    test_size: float
    random_state: int
    results: list[dict[str, Any]]


@router.post("/run", response_model=ExperimentRunResponse)
def run_experiment_api(payload: ExperimentRunRequest):
    try:
        df = get_dataset(payload.dataset_id)

        result = run_experiment(
            df=df,
            target_column=payload.target_column,
            task_type=payload.task_type,
            model_names=payload.model_names,
            test_size=payload.test_size,
            random_state=payload.random_state,
        )

        return {
            "dataset_id": payload.dataset_id,
            **result,
        }

    except DataServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except ExperimentError as e:
        raise HTTPException(status_code=400, detail=str(e))
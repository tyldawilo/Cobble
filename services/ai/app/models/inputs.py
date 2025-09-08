from pydantic import BaseModel


class DesignInputs(BaseModel):
    dead_load: float
    live_load: float
    wind_load: float
    concrete_strength: int
    rebar_strength: int


class AnalyzeRequest(BaseModel):
    project_id: str
    ifc_file_path: str
    design_inputs: DesignInputs
    user_id: str | None = None
    request_id: str | None = None



from fastapi import FastAPI
from .api.analyze import router as analyze_router
from fastapi.responses import JSONResponse

app = FastAPI(title="Cobble AI Service", version="0.1.0")


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})

app.include_router(analyze_router)



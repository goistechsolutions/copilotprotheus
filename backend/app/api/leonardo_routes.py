"""Leonardo AI — geração de imagens para o Copilot Protheus."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import httpx, os, asyncio

router = APIRouter(prefix="/api/leonardo", tags=["leonardo"])

LEO_KEY  = os.getenv("LEONARDO_API_KEY", "")
LEO_BASE = "https://cloud.leonardo.ai/api/rest/v1"
DEFAULT_MODEL = os.getenv("LEONARDO_MODEL_ID", "b24e16ff-06e3-43eb-8d33-4416c2d75876")  # Leonardo Phoenix


def _headers():
    if not LEO_KEY:
        raise HTTPException(503, "LEONARDO_API_KEY não configurada")
    return {"Authorization": f"Bearer {LEO_KEY}", "Content-Type": "application/json"}


class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = None
    model_id: Optional[str] = None
    width: int = 1024
    height: int = 1024
    num_images: int = 1
    guidance_scale: float = 7.0
    num_inference_steps: int = 30
    public: bool = False


@router.post("/generate")
async def generate_image(body: GenerateRequest):
    """Inicia geração de imagem via Leonardo AI."""
    payload = {
        "prompt":              body.prompt,
        "modelId":             body.model_id or DEFAULT_MODEL,
        "width":               body.width,
        "height":              body.height,
        "num_images":          body.num_images,
        "guidance_scale":      body.guidance_scale,
        "num_inference_steps": body.num_inference_steps,
        "public":              body.public,
    }
    if body.negative_prompt:
        payload["negative_prompt"] = body.negative_prompt

    async with httpx.AsyncClient() as client:
        r = await client.post(f"{LEO_BASE}/generations", json=payload, headers=_headers(), timeout=30)
    if not r.is_success:
        raise HTTPException(r.status_code, r.text)

    data = r.json()
    generation_id = data.get("sdGenerationJob", {}).get("generationId")
    return {"generation_id": generation_id, "status": "pending"}


@router.get("/generate/{generation_id}")
async def get_generation(generation_id: str):
    """Polling do status/resultado da geração."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{LEO_BASE}/generations/{generation_id}", headers=_headers(), timeout=20)
    r.raise_for_status()
    data = r.json().get("generations_by_pk", {})
    images: List[dict] = data.get("generated_images", [])
    return {
        "generation_id": generation_id,
        "status":        data.get("status", "PENDING"),
        "images":        [{"id": img["id"], "url": img["url"], "nsfw": img.get("nsfw", False)} for img in images],
    }


@router.post("/generate/wait")
async def generate_and_wait(body: GenerateRequest):
    """Gera imagem e aguarda conclusão (polling interno, max 60s)."""
    # Inicia geração
    init = await generate_image(body)
    gen_id = init["generation_id"]
    # Polling
    for _ in range(20):
        await asyncio.sleep(3)
        result = await get_generation(gen_id)
        if result["status"] == "COMPLETE":
            return result
        if result["status"] == "FAILED":
            raise HTTPException(500, "Geração falhou no Leonardo AI")
    raise HTTPException(504, "Timeout aguardando geração de imagem")


@router.get("/models")
async def list_models():
    """Lista modelos disponíveis na conta Leonardo AI."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{LEO_BASE}/platformModels", headers=_headers(), timeout=15)
    r.raise_for_status()
    return r.json().get("custom_models", [])

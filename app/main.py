from pathlib import Path
import os
import subprocess
import sys
import tempfile

import requests
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")

app = FastAPI(title="Accessible Code Learning Platform", version="0.1.0")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class TutorRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    code: str = Field(default="", max_length=20000)


class RunRequest(BaseModel):
    code: str = Field(min_length=1, max_length=12000)


@app.get("/")
def home():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health():
    """Check whether the local Ollama server is reachable and list its models."""
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        response.raise_for_status()
        models = [
            item.get("name", "")
            for item in response.json().get("models", [])
        ]
        return {
            "api": "ok",
            "ollama": "connected",
            "configured_model": OLLAMA_MODEL,
            "installed_models": models,
            "model_available": any(
                name == OLLAMA_MODEL or name.startswith(OLLAMA_MODEL + ":")
                for name in models
            ),
        }
    except requests.RequestException:
        return {
            "api": "ok",
            "ollama": "not reachable",
            "configured_model": OLLAMA_MODEL,
            "installed_models": [],
            "model_available": False,
        }


@app.post("/api/ask")
def ask_tutor(payload: TutorRequest):
    prompt = f"""
You are an accessible programming tutor helping a blind or visually impaired
beginner learn Python.

Teaching rules:
- Explain in plain, direct language.
- Be patient, but do not be overly verbose.
- Explain code in the order it executes.
- When referring to a line, state its line number.
- Explain unfamiliar programming terms briefly.
- Do not rely on visual descriptions, colors, indentation appearance, or screenshots.
- If the question asks about one line, focus on that line and its role in the program.
- If the code contains an error, identify the likely error and suggest a correction.
- Do not claim that code was executed unless the execution tool actually did so.

Student question:
{payload.question}

Current Python code:
```python
{payload.code}
```

Answer in a format that is easy for a screen reader to read aloud.
Avoid markdown tables.
"""

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.2,
                    "num_ctx": 2048,
                    "num_predict": 300,
                },
            },
            timeout=240,
        )
        response.raise_for_status()
        answer = response.json().get("response", "").strip()
        if not answer:
            raise HTTPException(status_code=502, detail="The AI tutor returned an empty response.")
        return {"answer": answer}
    except requests.ConnectionError:
        raise HTTPException(
            status_code=503,
            detail="Cannot connect to Ollama. Start Ollama and check that the model is installed.",
        )
    except requests.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Ollama took too long to respond. Try a shorter question or a smaller model.",
        )
    except requests.HTTPError as exc:
        detail = "Ollama returned an error."
        if exc.response is not None:
            try:
                detail = exc.response.json().get("error", detail)
            except ValueError:
                pass
        raise HTTPException(status_code=502, detail=detail)


@app.post("/api/run")
def run_python(payload: RunRequest):
    """
    Run a short Python program locally with a time limit.

    IMPORTANT: This is a learning/demo runner, NOT a secure sandbox.
    Only run code you trust. Do not expose this endpoint to the public internet.
    """
    with tempfile.TemporaryDirectory(prefix="accessible_code_") as temp_dir:
        script_path = Path(temp_dir) / "student_program.py"
        script_path.write_text(payload.code, encoding="utf-8")

        try:
            result = subprocess.run(
                [sys.executable, str(script_path)],
                cwd=temp_dir,
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            return {
                "stdout": result.stdout[:8000],
                "stderr": result.stderr[:8000],
                "return_code": result.returncode,
                "timed_out": False,
            }
        except subprocess.TimeoutExpired as exc:
            stdout = exc.stdout or ""
            stderr = exc.stderr or ""
            if isinstance(stdout, bytes):
                stdout = stdout.decode("utf-8", errors="replace")
            if isinstance(stderr, bytes):
                stderr = stderr.decode("utf-8", errors="replace")
            return {
                "stdout": stdout[:8000],
                "stderr": (stderr + "\nExecution stopped: 5-second time limit reached.")[:8000],
                "return_code": None,
                "timed_out": True,
            }

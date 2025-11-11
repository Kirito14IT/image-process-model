import io
import os
import re
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from PIL import Image

from .model_runner import runner, global_lock


APP_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODELS_DIR = APP_ROOT / 'server' / 'saved_models'
TMP_DIR = APP_ROOT / 'server' / 'tmp'
TMP_DIR.mkdir(parents=True, exist_ok=True)

MESSAGE_RE = re.compile(r'^[A-Za-z0-9]{7}$')

app = FastAPI(title='ImageProcess Stega API', version='v1')


def resolve_model_dir(model_name: Optional[str]) -> Path:
    base = DEFAULT_MODELS_DIR
    if model_name:
        return base / model_name
    # fallback: env MODEL_DIR
    env_dir = os.environ.get('MODEL_DIR')
    if env_dir:
        return Path(env_dir)
    # If only one subdir, use it
    subs = [p for p in base.iterdir() if p.is_dir()]
    if len(subs) == 1:
        return subs[0]
    raise HTTPException(status_code=500, detail='MODEL_DIR not set and multiple/no models found')


class DecodeResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None


@app.get('/api/v1/ping')
def ping():
    return {'ok': True}


@app.get('/api/v1/models')
def list_models():
    base = DEFAULT_MODELS_DIR
    if not base.exists():
        return {'models': []}
    models = [p.name for p in base.iterdir() if p.is_dir()]
    return {'models': models}


@app.post('/api/v1/encode')
def encode_image(
    image: UploadFile = File(...),
    message: str = Form(...),
    model: Optional[str] = Form(None),
):
    if not MESSAGE_RE.match(message):
        raise HTTPException(status_code=400, detail='message must be 7 alphanumeric chars')

    model_dir = resolve_model_dir(model)
    try:
        with global_lock:
            runner.load(str(model_dir))
            pil_img = Image.open(image.file)
            im_hidden, im_raw, im_residual = runner.encode(pil_img, message)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'encode failed: {e}')

    # PNG-only response
    buf = io.BytesIO()
    im_hidden.save(buf, format='PNG')
    buf.seek(0)

    # Optional debug save
    if os.environ.get('DEBUG_SAVE', '').lower() in ('1', 'true', 'yes'):
        TMP_DIR.mkdir(parents=True, exist_ok=True)
        base = Path(image.filename or 'upload').stem
        im_raw.save(TMP_DIR / f'{base}_raw.png')
        im_hidden.save(TMP_DIR / f'{base}_hidden.png')
        im_residual.save(TMP_DIR / f'{base}_residual.png')

    return StreamingResponse(buf, media_type='image/png')


@app.post('/api/v1/decode', response_model=DecodeResponse)
def decode_image(
    image: UploadFile = File(...),
    model: Optional[str] = Form(None),
):
    model_dir = resolve_model_dir(model)
    try:
        with global_lock:
            runner.load(str(model_dir))
            pil_img = Image.open(image.file)
            code = runner.decode(pil_img)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'decode failed: {e}')

    if code is None:
        return DecodeResponse(success=False, error='未能解析出有效水印信息')
    return DecodeResponse(success=True, data={'message': code.strip(), 'model_used': Path(model_dir).name})

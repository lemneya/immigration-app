"""
Bmore MT Gateway - Machine Translation Service
Supports LibreTranslate, Marian OPUS-MT, and NLLB via CTranslate2
"""

import os
import asyncio
import logging
from typing import List, Dict, Optional, Union
from contextlib import asynccontextmanager
import json
import time

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn
import httpx
import redis
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from prometheus_client import CollectorRegistry, REGISTRY
import psutil

from .providers import LibreTranslateProvider, MarianProvider, NLLBProvider
from .models import TranslationRequest, BatchTranslationRequest, TranslationResponse, BatchTranslationResponse
from .utils import detect_language, validate_language_pair, normalize_text

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Metrics
translation_counter = Counter('mt_translations_total', 'Total translations', ['provider', 'src_lang', 'tgt_lang'])
translation_duration = Histogram('mt_translation_duration_seconds', 'Translation duration', ['provider'])
batch_size_histogram = Histogram('mt_batch_size', 'Batch translation sizes', buckets=[1, 5, 10, 25, 50, 100, 200])

# Global variables
providers = {}
redis_client = None

class HealthResponse(BaseModel):
    status: str
    provider: str
    available_pairs: List[Dict[str, str]]
    memory_usage: Dict[str, float]
    redis_connected: bool

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup"""
    global providers, redis_client
    
    logger.info("Initializing MT Gateway...")
    
    # Initialize Redis
    try:
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
        redis_client = redis.from_url(redis_url, decode_responses=True)
        redis_client.ping()
        logger.info("Redis connected successfully")
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}")
        redis_client = None
    
    # Initialize MT providers
    provider_name = os.getenv("MT_PROVIDER", "LIBRE").upper()
    
    try:
        if provider_name == "LIBRE":
            providers['libre'] = LibreTranslateProvider(
                url=os.getenv("LIBRE_URL", "http://libre:5000")
            )
            await providers['libre'].initialize()
            
        elif provider_name == "MARIAN":
            providers['marian'] = MarianProvider(
                model_dir=os.getenv("MODEL_DIR", "/models"),
                device=os.getenv("CTRANSLATE_DEVICE", "cpu"),
                threads=int(os.getenv("CTRANSLATE_THREADS", "4"))
            )
            await providers['marian'].initialize()
            
        elif provider_name == "NLLB":
            providers['nllb'] = NLLBProvider(
                model_dir=os.getenv("MODEL_DIR", "/models"),
                device=os.getenv("CTRANSLATE_DEVICE", "cpu"),
                threads=int(os.getenv("CTRANSLATE_THREADS", "4"))
            )
            await providers['nllb'].initialize()
            
        else:
            raise ValueError(f"Unknown provider: {provider_name}")
            
        logger.info(f"MT Provider '{provider_name}' initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize provider {provider_name}: {e}")
        raise
    
    yield
    
    # Cleanup
    logger.info("Shutting down MT Gateway...")
    if redis_client:
        redis_client.close()

# Create FastAPI app
app = FastAPI(
    title="Bmore MT Gateway",
    description="Machine Translation Gateway for Certified Translation Assistant",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_provider():
    """Get the active MT provider"""
    provider_name = os.getenv("MT_PROVIDER", "LIBRE").lower()
    provider = providers.get(provider_name)
    
    if not provider:
        raise HTTPException(
            status_code=503, 
            detail=f"Provider '{provider_name}' not available"
        )
    return provider

def cache_key(text: str, src: str, tgt: str, provider: str) -> str:
    """Generate cache key for translation"""
    import hashlib
    content = f"{provider}:{src}:{tgt}:{text}"
    return f"mt:{hashlib.md5(content.encode()).hexdigest()[:16]}"

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    provider_name = os.getenv("MT_PROVIDER", "LIBRE").lower()
    provider = providers.get(provider_name)
    
    if not provider:
        raise HTTPException(status_code=503, detail="Provider not initialized")
    
    # Get memory usage
    memory = psutil.virtual_memory()
    memory_usage = {
        "total": memory.total / (1024**3),  # GB
        "available": memory.available / (1024**3),
        "percent": memory.percent,
        "used": memory.used / (1024**3)
    }
    
    return HealthResponse(
        status="healthy",
        provider=provider_name,
        available_pairs=await provider.get_supported_languages(),
        memory_usage=memory_usage,
        redis_connected=redis_client is not None and redis_client.ping()
    )

@app.post("/translate", response_model=TranslationResponse)
async def translate_text(
    request: TranslationRequest,
    provider=Depends(get_provider)
):
    """Translate single text"""
    start_time = time.time()
    
    try:
        # Validate language pair
        if not await validate_language_pair(provider, request.src, request.tgt):
            raise HTTPException(
                status_code=400,
                detail=f"Language pair {request.src}->{request.tgt} not supported"
            )
        
        # Check cache first
        if redis_client:
            cache_key_str = cache_key(
                request.text, request.src, request.tgt, 
                os.getenv("MT_PROVIDER", "LIBRE")
            )
            cached = redis_client.get(cache_key_str)
            if cached:
                logger.info("Cache hit for translation")
                return TranslationResponse(
                    text=cached,
                    src=request.src,
                    tgt=request.tgt,
                    provider=os.getenv("MT_PROVIDER", "LIBRE"),
                    cached=True
                )
        
        # Normalize text
        normalized_text = normalize_text(request.text)
        
        # Translate
        translated = await provider.translate(normalized_text, request.src, request.tgt)
        
        # Cache result
        if redis_client:
            redis_client.setex(cache_key_str, 3600, translated)  # 1 hour cache
        
        # Update metrics
        translation_counter.labels(
            provider=os.getenv("MT_PROVIDER", "LIBRE"),
            src_lang=request.src,
            tgt_lang=request.tgt
        ).inc()
        
        translation_duration.labels(
            provider=os.getenv("MT_PROVIDER", "LIBRE")
        ).observe(time.time() - start_time)
        
        return TranslationResponse(
            text=translated,
            src=request.src,
            tgt=request.tgt,
            provider=os.getenv("MT_PROVIDER", "LIBRE"),
            cached=False
        )
        
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/translate/batch", response_model=BatchTranslationResponse)
async def translate_batch(
    request: BatchTranslationRequest,
    background_tasks: BackgroundTasks,
    provider=Depends(get_provider)
):
    """Translate batch of texts"""
    start_time = time.time()
    
    try:
        # Validate language pair
        if not await validate_language_pair(provider, request.src, request.tgt):
            raise HTTPException(
                status_code=400,
                detail=f"Language pair {request.src}->{request.tgt} not supported"
            )
        
        # Check batch size
        if len(request.segments) > 500:
            raise HTTPException(
                status_code=400,
                detail="Batch size too large (max 500 segments)"
            )
        
        batch_size_histogram.observe(len(request.segments))
        
        # Check cache for each segment
        translations = []
        uncached_indices = []
        uncached_texts = []
        
        for i, text in enumerate(request.segments):
            if redis_client:
                cache_key_str = cache_key(
                    text, request.src, request.tgt,
                    os.getenv("MT_PROVIDER", "LIBRE")
                )
                cached = redis_client.get(cache_key_str)
                if cached:
                    translations.append(cached)
                    continue
            
            # Not cached
            translations.append(None)
            uncached_indices.append(i)
            uncached_texts.append(normalize_text(text))
        
        # Translate uncached segments
        if uncached_texts:
            logger.info(f"Translating {len(uncached_texts)} uncached segments")
            translated_batch = await provider.translate_batch(
                uncached_texts, request.src, request.tgt
            )
            
            # Fill in translations and cache
            for idx, translation in zip(uncached_indices, translated_batch):
                translations[idx] = translation
                
                # Cache in background
                if redis_client:
                    cache_key_str = cache_key(
                        request.segments[idx], request.src, request.tgt,
                        os.getenv("MT_PROVIDER", "LIBRE")
                    )
                    background_tasks.add_task(
                        lambda k=cache_key_str, v=translation: redis_client.setex(k, 3600, v)
                    )
        
        # Update metrics
        translation_counter.labels(
            provider=os.getenv("MT_PROVIDER", "LIBRE"),
            src_lang=request.src,
            tgt_lang=request.tgt
        ).inc(len(request.segments))
        
        translation_duration.labels(
            provider=os.getenv("MT_PROVIDER", "LIBRE")
        ).observe(time.time() - start_time)
        
        return BatchTranslationResponse(
            segments=translations,
            src=request.src,
            tgt=request.tgt,
            provider=os.getenv("MT_PROVIDER", "LIBRE"),
            count=len(translations),
            cached_count=len(request.segments) - len(uncached_texts)
        )
        
    except Exception as e:
        logger.error(f"Batch translation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/languages")
async def get_supported_languages(provider=Depends(get_provider)):
    """Get supported language pairs"""
    try:
        return await provider.get_supported_languages()
    except Exception as e:
        logger.error(f"Failed to get languages: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/detect")
async def detect_text_language(text: str, provider=Depends(get_provider)):
    """Detect language of text"""
    try:
        if len(text.strip()) < 3:
            raise HTTPException(status_code=400, detail="Text too short for detection")
        
        detected = detect_language(text)
        return {"language": detected, "text": text[:100] + "..." if len(text) > 100 else text}
    except Exception as e:
        logger.error(f"Language detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return JSONResponse(
        content=generate_latest(REGISTRY).decode(),
        media_type=CONTENT_TYPE_LATEST
    )

@app.get("/stats")
async def get_stats():
    """Get service statistics"""
    try:
        stats = {
            "provider": os.getenv("MT_PROVIDER", "LIBRE"),
            "uptime_seconds": time.time() - start_time if 'start_time' in globals() else 0,
            "redis_connected": redis_client is not None and redis_client.ping() if redis_client else False,
            "memory_usage": {
                "percent": psutil.virtual_memory().percent,
                "available_gb": psutil.virtual_memory().available / (1024**3)
            },
            "cpu_percent": psutil.cpu_percent(interval=1)
        }
        
        if redis_client:
            try:
                redis_info = redis_client.info()
                stats["redis_info"] = {
                    "connected_clients": redis_info.get("connected_clients", 0),
                    "used_memory_mb": redis_info.get("used_memory", 0) / (1024**2),
                    "keyspace_hits": redis_info.get("keyspace_hits", 0),
                    "keyspace_misses": redis_info.get("keyspace_misses", 0)
                }
            except:
                pass
        
        return stats
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Record start time
start_time = time.time()

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 7001)),
        reload=os.getenv("ENV") == "development",
        log_level="info"
    )
"""
Pydantic models for MT Gateway
"""

from typing import List, Optional
from pydantic import BaseModel, Field, validator

class TranslationRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="Text to translate")
    src: str = Field(..., min_length=2, max_length=5, description="Source language code")
    tgt: str = Field(..., min_length=2, max_length=5, description="Target language code")
    options: Optional[dict] = Field(default=None, description="Provider-specific options")
    
    @validator('text')
    def validate_text(cls, v):
        if not v.strip():
            raise ValueError('Text cannot be empty')
        return v.strip()
    
    @validator('src', 'tgt')
    def validate_language_codes(cls, v):
        # Normalize language codes
        if v == 'ara': return 'ar'
        if v == 'spa': return 'es'  
        if v == 'fra': return 'fr'
        if v == 'eng': return 'en'
        return v.lower()

class TranslationResponse(BaseModel):
    text: str = Field(..., description="Translated text")
    src: str = Field(..., description="Source language code")
    tgt: str = Field(..., description="Target language code")
    provider: str = Field(..., description="MT provider used")
    cached: bool = Field(default=False, description="Whether result was cached")
    confidence: Optional[float] = Field(default=None, description="Translation confidence score")

class BatchTranslationRequest(BaseModel):
    segments: List[str] = Field(..., min_items=1, max_items=500, description="Text segments to translate")
    src: str = Field(..., min_length=2, max_length=5, description="Source language code")
    tgt: str = Field(..., min_length=2, max_length=5, description="Target language code")
    options: Optional[dict] = Field(default=None, description="Provider-specific options")
    
    @validator('segments')
    def validate_segments(cls, v):
        if not v:
            raise ValueError('Segments list cannot be empty')
        
        # Filter out empty segments
        filtered = [s.strip() for s in v if s.strip()]
        if not filtered:
            raise ValueError('All segments are empty')
            
        # Check individual segment length
        for segment in filtered:
            if len(segment) > 5000:
                raise ValueError(f'Segment too long (max 5000 chars): {segment[:100]}...')
        
        return filtered
    
    @validator('src', 'tgt')
    def validate_language_codes(cls, v):
        # Normalize language codes
        if v == 'ara': return 'ar'
        if v == 'spa': return 'es'  
        if v == 'fra': return 'fr'
        if v == 'eng': return 'en'
        return v.lower()

class BatchTranslationResponse(BaseModel):
    segments: List[str] = Field(..., description="Translated text segments")
    src: str = Field(..., description="Source language code")
    tgt: str = Field(..., description="Target language code")
    provider: str = Field(..., description="MT provider used")
    count: int = Field(..., description="Number of segments translated")
    cached_count: int = Field(default=0, description="Number of cached segments")
    total_time: Optional[float] = Field(default=None, description="Total translation time in seconds")

class LanguagePair(BaseModel):
    source: str = Field(..., description="Source language code")
    target: str = Field(..., description="Target language code")
    name: Optional[str] = Field(default=None, description="Human-readable name")

class DetectionResult(BaseModel):
    language: str = Field(..., description="Detected language code")
    confidence: Optional[float] = Field(default=None, description="Detection confidence")
    text_preview: str = Field(..., description="Preview of detected text")

class ProviderStatus(BaseModel):
    name: str = Field(..., description="Provider name")
    status: str = Field(..., description="Provider status")
    supported_pairs: List[LanguagePair] = Field(..., description="Supported language pairs")
    model_info: Optional[dict] = Field(default=None, description="Model information")
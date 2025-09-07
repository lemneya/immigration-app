"""
Pydantic models for Format Service API
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from enum import Enum

class FileFormat(str, Enum):
    """Supported file formats"""
    PDF = "pdf"
    DOCX = "docx"
    DOC = "doc"
    TXT = "txt"
    RTF = "rtf"
    ODT = "odt"
    HTML = "html"
    XLSX = "xlsx"
    XLS = "xls"
    ODS = "ods"
    PPTX = "pptx"
    PPT = "ppt"
    ODP = "odp"
    XLIFF = "xliff"
    TMX = "tmx"

class XLIFFVersion(str, Enum):
    """Supported XLIFF versions"""
    V12 = "1.2"
    V20 = "2.0"
    V21 = "2.1"

class ProcessingStatus(str, Enum):
    """Processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class SegmentationRule(str, Enum):
    """Segmentation rules for XLIFF"""
    SENTENCE = "sentence"
    PARAGRAPH = "paragraph"
    LINE = "line"
    CUSTOM = "custom"

class DocumentInfo(BaseModel):
    """Document analysis response"""
    filename: str
    file_type: str
    file_size: int = Field(description="File size in bytes")
    word_count: int = 0
    page_count: int = 1
    language_detected: str = "unknown"
    text_preview: str = ""
    extractable_formats: List[str] = []
    okapi_supported: bool = False
    metadata: Dict[str, Any] = {}

class ConversionRequest(BaseModel):
    """Document conversion options"""
    preserve_formatting: bool = True
    extract_images: bool = False
    ocr_if_needed: bool = True
    merge_pages: bool = False
    custom_options: Dict[str, Any] = {}

class SegmentationOptions(BaseModel):
    """XLIFF segmentation options"""
    rule: SegmentationRule = SegmentationRule.SENTENCE
    preserve_whitespace: bool = True
    merge_short_segments: bool = False
    min_segment_length: int = 10
    max_segment_length: int = 500
    custom_patterns: List[str] = []

class TranslationSegment(BaseModel):
    """Single translation segment"""
    id: str
    source_text: str
    target_text: str = ""
    status: str = "new"
    approved: bool = False
    locked: bool = False
    notes: List[str] = []
    metadata: Dict[str, Any] = {}

class FormatResponse(BaseModel):
    """Document conversion response"""
    job_id: str
    status: ProcessingStatus
    original_filename: str
    converted_filename: Optional[str] = None
    output_format: str
    file_path: Optional[str] = None
    download_url: Optional[str] = None
    word_count: Optional[int] = None
    processing_time: Optional[float] = None
    metadata: Dict[str, Any] = {}
    error_message: Optional[str] = None

class XLIFFResponse(BaseModel):
    """XLIFF creation response"""
    job_id: str
    status: ProcessingStatus
    original_filename: str
    xliff_filename: Optional[str] = None
    source_language: str
    target_language: str
    xliff_version: XLIFFVersion = XLIFFVersion.V20
    segment_count: int = 0
    word_count: int = 0
    download_url: Optional[str] = None
    preview_segments: List[TranslationSegment] = []
    processing_time: Optional[float] = None
    metadata: Dict[str, Any] = {}
    error_message: Optional[str] = None

class XLIFFMergeRequest(BaseModel):
    """XLIFF merge options"""
    target_format: FileFormat = FileFormat.DOCX
    preserve_source_formatting: bool = True
    include_pending_segments: bool = False
    export_options: Dict[str, Any] = {}

class TranslationStats(BaseModel):
    """Translation completion statistics"""
    total_segments: int
    translated_segments: int
    approved_segments: int
    pending_segments: int
    completion_percentage: float
    word_count_translated: int
    word_count_total: int

class JobStatus(BaseModel):
    """Job status response"""
    job_id: str
    status: ProcessingStatus
    progress_percentage: float = 0.0
    current_step: Optional[str] = None
    estimated_completion: Optional[str] = None
    created_at: str
    updated_at: str
    error_details: Optional[str] = None

class SupportedFormats(BaseModel):
    """Supported formats response"""
    input_formats: List[str]
    output_formats: List[str]
    xliff_versions: List[str]
    okapi_formats: List[str]
    features: Dict[str, List[str]] = {}

class ErrorResponse(BaseModel):
    """Error response model"""
    error: str
    details: Optional[str] = None
    job_id: Optional[str] = None
    timestamp: str
    
class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    service: str
    version: str
    okapi_available: bool
    dependencies: Dict[str, str] = {}
    uptime: Optional[float] = None
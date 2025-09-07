"""
Format Service with Okapi XLIFF Integration
Handles document format conversion and XLIFF generation for CAT tools
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import os
import logging
import asyncio
from typing import List, Optional
from uuid import uuid4
import tempfile
import shutil

from .models import (
    FormatResponse, XLIFFResponse, DocumentInfo, 
    ConversionRequest, SegmentationOptions
)
from .processors import (
    DocumentProcessor, XLIFFProcessor, OkapiProcessor
)
from .utils import (
    detect_file_type, extract_text_content, 
    validate_file_size, cleanup_temp_files
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Bmore Format Service",
    description="Document format conversion and XLIFF generation for translation workflows",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on your security needs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize processors
doc_processor = DocumentProcessor()
xliff_processor = XLIFFProcessor()
okapi_processor = OkapiProcessor()

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    try:
        # Create required directories
        os.makedirs(os.getenv('TEMP_DIR', '/app/temp'), exist_ok=True)
        os.makedirs(os.getenv('OUTPUT_DIR', '/app/output'), exist_ok=True)
        os.makedirs(os.getenv('UPLOAD_DIR', '/app/uploads'), exist_ok=True)
        
        # Initialize Okapi
        await okapi_processor.initialize()
        
        logger.info("Format service started successfully")
        
    except Exception as e:
        logger.error(f"Failed to start format service: {e}")
        raise

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "format-service",
        "version": "1.0.0",
        "okapi_available": await okapi_processor.is_available()
    }

@app.post("/analyze", response_model=DocumentInfo)
async def analyze_document(file: UploadFile = File(...)):
    """
    Analyze uploaded document and extract metadata
    """
    try:
        # Validate file
        if not validate_file_size(file, max_size_mb=100):
            raise HTTPException(status_code=413, detail="File too large")
        
        # Create temp file
        temp_id = str(uuid4())
        temp_path = f"{os.getenv('TEMP_DIR', '/tmp')}/{temp_id}_{file.filename}"
        
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        try:
            # Detect file type
            file_type = detect_file_type(temp_path)
            
            # Extract basic info
            file_info = await doc_processor.analyze_document(temp_path, file_type)
            
            # Extract text preview
            text_preview = extract_text_content(temp_path, file_type, max_chars=1000)
            
            return DocumentInfo(
                filename=file.filename,
                file_type=file_type,
                file_size=len(content),
                word_count=file_info.get('word_count', 0),
                page_count=file_info.get('page_count', 1),
                language_detected=file_info.get('language', 'unknown'),
                text_preview=text_preview,
                extractable_formats=file_info.get('extractable_formats', []),
                okapi_supported=await okapi_processor.is_supported_format(file_type),
                metadata=file_info.get('metadata', {})
            )
            
        finally:
            # Cleanup temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            
    except Exception as e:
        logger.error(f"Document analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/convert", response_model=FormatResponse)
async def convert_document(
    file: UploadFile = File(...),
    target_format: str = "txt",
    options: Optional[ConversionRequest] = None
):
    """
    Convert document to target format
    """
    try:
        # Create unique job ID
        job_id = str(uuid4())
        temp_dir = f"{os.getenv('TEMP_DIR', '/tmp')}/{job_id}"
        os.makedirs(temp_dir, exist_ok=True)
        
        # Save uploaded file
        input_path = f"{temp_dir}/input_{file.filename}"
        with open(input_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        try:
            # Process conversion
            result = await doc_processor.convert_document(
                input_path=input_path,
                target_format=target_format,
                output_dir=temp_dir,
                options=options
            )
            
            return FormatResponse(
                job_id=job_id,
                status="completed",
                original_filename=file.filename,
                converted_filename=result['filename'],
                output_format=target_format,
                file_path=result['path'],
                download_url=f"/download/{job_id}/{result['filename']}",
                word_count=result.get('word_count'),
                metadata=result.get('metadata', {})
            )
            
        except Exception as e:
            # Cleanup on error
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise e
            
    except Exception as e:
        logger.error(f"Document conversion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/xliff", response_model=XLIFFResponse)
async def create_xliff(
    file: UploadFile = File(...),
    source_lang: str = "auto",
    target_lang: str = "en",
    segmentation: Optional[SegmentationOptions] = None
):
    """
    Create XLIFF file from document for CAT tool workflow
    """
    try:
        # Create unique job ID
        job_id = str(uuid4())
        temp_dir = f"{os.getenv('TEMP_DIR', '/tmp')}/{job_id}"
        os.makedirs(temp_dir, exist_ok=True)
        
        # Save uploaded file
        input_path = f"{temp_dir}/input_{file.filename}"
        with open(input_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        try:
            file_type = detect_file_type(input_path)
            
            # Use Okapi if supported, otherwise fallback to internal processor
            if await okapi_processor.is_supported_format(file_type):
                result = await okapi_processor.create_xliff(
                    input_path=input_path,
                    source_lang=source_lang,
                    target_lang=target_lang,
                    output_dir=temp_dir,
                    options=segmentation
                )
            else:
                result = await xliff_processor.create_xliff(
                    input_path=input_path,
                    source_lang=source_lang,
                    target_lang=target_lang,
                    output_dir=temp_dir,
                    options=segmentation
                )
            
            return XLIFFResponse(
                job_id=job_id,
                status="completed",
                original_filename=file.filename,
                xliff_filename=result['xliff_filename'],
                source_language=source_lang,
                target_language=target_lang,
                segment_count=result['segment_count'],
                word_count=result['word_count'],
                download_url=f"/download/{job_id}/{result['xliff_filename']}",
                preview_segments=result.get('preview_segments', []),
                metadata=result.get('metadata', {})
            )
            
        except Exception as e:
            # Cleanup on error
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise e
            
    except Exception as e:
        logger.error(f"XLIFF creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/xliff/merge")
async def merge_xliff(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks
):
    """
    Merge completed XLIFF back to original format
    """
    try:
        # Create unique job ID
        job_id = str(uuid4())
        temp_dir = f"{os.getenv('TEMP_DIR', '/tmp')}/{job_id}"
        os.makedirs(temp_dir, exist_ok=True)
        
        # Save XLIFF file
        xliff_path = f"{temp_dir}/translation.xliff"
        with open(xliff_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        try:
            # Process merge
            result = await xliff_processor.merge_xliff(
                xliff_path=xliff_path,
                output_dir=temp_dir
            )
            
            # Schedule cleanup
            background_tasks.add_task(cleanup_temp_files, temp_dir, delay_minutes=60)
            
            return {
                "job_id": job_id,
                "status": "completed",
                "merged_filename": result['filename'],
                "download_url": f"/download/{job_id}/{result['filename']}",
                "translation_stats": result.get('stats', {})
            }
            
        except Exception as e:
            # Cleanup on error
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise e
            
    except Exception as e:
        logger.error(f"XLIFF merge failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download/{job_id}/{filename}")
async def download_file(job_id: str, filename: str):
    """
    Download processed file
    """
    try:
        file_path = f"{os.getenv('TEMP_DIR', '/tmp')}/{job_id}/{filename}"
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type='application/octet-stream'
        )
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        logger.error(f"File download failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/cleanup/{job_id}")
async def cleanup_job(job_id: str):
    """
    Manually cleanup job files
    """
    try:
        temp_dir = f"{os.getenv('TEMP_DIR', '/tmp')}/{job_id}"
        
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
            return {"status": "cleaned", "job_id": job_id}
        else:
            return {"status": "not_found", "job_id": job_id}
            
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/formats")
async def get_supported_formats():
    """
    Get list of supported input and output formats
    """
    return {
        "input_formats": [
            "pdf", "docx", "doc", "txt", "rtf", "odt",
            "xlsx", "xls", "ods", "pptx", "ppt", "odp"
        ],
        "output_formats": [
            "txt", "docx", "pdf", "html", "xliff", "tmx"
        ],
        "okapi_formats": await okapi_processor.get_supported_formats(),
        "xliff_versions": ["1.2", "2.0", "2.1"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
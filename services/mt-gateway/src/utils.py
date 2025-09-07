"""
Utility functions for MT Gateway
"""

import re
import logging
from typing import Optional
from langdetect import detect, DetectorFactory

# Make language detection deterministic
DetectorFactory.seed = 0

logger = logging.getLogger(__name__)

def normalize_text(text: str) -> str:
    """Normalize text for translation"""
    if not text:
        return text
    
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text.strip())
    
    # Fix common issues with scanned documents
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)  # Split camelCase
    text = re.sub(r'(\d)([A-Z])', r'\1 \2', text)     # Split numberLetter
    text = re.sub(r'([a-z])(\d)', r'\1 \2', text)     # Split letterNumber
    
    # Normalize punctuation spacing
    text = re.sub(r'\s*([,.;:!?])\s*', r'\1 ', text)
    text = re.sub(r'\s+', ' ', text.strip())
    
    return text

def detect_language(text: str, confidence_threshold: float = 0.8) -> Optional[str]:
    """Detect language of text with confidence filtering"""
    try:
        if not text or len(text.strip()) < 3:
            return None
        
        # Clean text for detection
        clean_text = re.sub(r'[^\w\s]', ' ', text)
        clean_text = re.sub(r'\d+', ' ', clean_text)
        clean_text = re.sub(r'\s+', ' ', clean_text.strip())
        
        if len(clean_text) < 10:
            return None
        
        detected = detect(clean_text)
        
        # Map some common variations
        lang_mapping = {
            'ca': 'es',  # Catalan -> Spanish
            'pt': 'es',  # Portuguese -> Spanish (close enough for routing)
        }
        
        return lang_mapping.get(detected, detected)
        
    except Exception as e:
        logger.warning(f"Language detection failed: {e}")
        return None

async def validate_language_pair(provider, src: str, tgt: str) -> bool:
    """Validate if language pair is supported by provider"""
    try:
        supported = await provider.get_supported_languages()
        
        for pair in supported:
            if pair['source'] == src and pair['target'] == tgt:
                return True
        
        return False
        
    except Exception as e:
        logger.error(f"Failed to validate language pair: {e}")
        return False

def extract_metadata_from_text(text: str) -> dict:
    """Extract metadata from document text for translation context"""
    metadata = {}
    
    # Detect document type based on patterns
    patterns = {
        'birth_certificate': [
            r'birth\s+certificate',
            r'certificate\s+of\s+birth',
            r'born\s+on',
            r'date\s+of\s+birth',
            r'padre|father',
            r'madre|mother'
        ],
        'marriage_certificate': [
            r'marriage\s+certificate',
            r'certificate\s+of\s+marriage',
            r'married\s+on',
            r'date\s+of\s+marriage',
            r'spouse',
            r'husband|wife'
        ],
        'diploma': [
            r'diploma',
            r'degree',
            r'bachelor|master|doctorate',
            r'university|college',
            r'graduated',
            r'conferred'
        ],
        'police_record': [
            r'police\s+record',
            r'criminal\s+record',
            r'background\s+check',
            r'no\s+record',
            r'clean\s+record'
        ]
    }
    
    text_lower = text.lower()
    
    for doc_type, type_patterns in patterns.items():
        matches = sum(1 for pattern in type_patterns if re.search(pattern, text_lower))
        if matches >= 2:  # Need at least 2 pattern matches
            metadata['document_type'] = doc_type
            metadata['confidence'] = min(1.0, matches / len(type_patterns))
            break
    
    # Extract dates
    date_patterns = [
        r'\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b',
        r'\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b',
        r'\b\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b'
    ]
    
    dates = []
    for pattern in date_patterns:
        matches = re.findall(pattern, text_lower)
        dates.extend(matches)
    
    if dates:
        metadata['dates_found'] = dates[:5]  # Keep first 5 dates
    
    # Extract potential names (capitalized words)
    name_pattern = r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b'
    potential_names = re.findall(name_pattern, text)
    
    if potential_names:
        # Filter out common words
        common_words = {
            'Certificate', 'Birth', 'Marriage', 'Police', 'Record', 'State', 'City', 
            'County', 'Department', 'Office', 'Minister', 'Date', 'Place', 'Number'
        }
        names = [name for name in potential_names if name not in common_words]
        if names:
            metadata['potential_names'] = names[:10]  # Keep first 10
    
    return metadata

def validate_translation_quality(source: str, translation: str, src_lang: str, tgt_lang: str) -> dict:
    """Basic quality checks for translations"""
    issues = []
    
    # Length ratio check (translations shouldn't be too different in length)
    length_ratio = len(translation) / len(source) if source else 0
    if length_ratio < 0.3 or length_ratio > 3.0:
        issues.append({
            'type': 'length_mismatch',
            'description': f'Translation length ratio unusual: {length_ratio:.2f}',
            'severity': 'warning'
        })
    
    # Number preservation check
    source_numbers = re.findall(r'\d+', source)
    translation_numbers = re.findall(r'\d+', translation)
    
    if len(source_numbers) != len(translation_numbers):
        issues.append({
            'type': 'number_mismatch',
            'description': f'Numbers in source ({len(source_numbers)}) vs translation ({len(translation_numbers)})',
            'severity': 'warning'
        })
    elif source_numbers != translation_numbers:
        issues.append({
            'type': 'number_change',
            'description': 'Numbers changed during translation',
            'severity': 'error'
        })
    
    # Date pattern check
    date_patterns = [
        r'\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b',
        r'\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b'
    ]
    
    source_dates = []
    translation_dates = []
    
    for pattern in date_patterns:
        source_dates.extend(re.findall(pattern, source))
        translation_dates.extend(re.findall(pattern, translation))
    
    if len(source_dates) != len(translation_dates):
        issues.append({
            'type': 'date_mismatch',
            'description': 'Date count mismatch between source and translation',
            'severity': 'warning'
        })
    
    # Empty or very short translation
    if not translation.strip() or len(translation.strip()) < 3:
        issues.append({
            'type': 'empty_translation',
            'description': 'Translation is empty or too short',
            'severity': 'error'
        })
    
    # Same as source (might indicate translation failure)
    if source.strip() == translation.strip():
        issues.append({
            'type': 'no_translation',
            'description': 'Translation identical to source',
            'severity': 'warning'
        })
    
    return {
        'issues': issues,
        'quality_score': max(0, 1.0 - (len([i for i in issues if i['severity'] == 'error']) * 0.3) - 
                               (len([i for i in issues if i['severity'] == 'warning']) * 0.1)),
        'length_ratio': length_ratio,
        'has_numbers': len(source_numbers) > 0,
        'has_dates': len(source_dates) > 0
    }

def segment_text_for_translation(text: str, max_length: int = 500) -> list:
    """Segment long text into translation-friendly chunks"""
    if len(text) <= max_length:
        return [text]
    
    # Split by sentences first
    sentence_endings = r'[.!?]+'
    sentences = re.split(sentence_endings, text)
    
    segments = []
    current_segment = ""
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        
        if len(current_segment) + len(sentence) <= max_length:
            current_segment += sentence + ". "
        else:
            if current_segment:
                segments.append(current_segment.strip())
            current_segment = sentence + ". "
    
    if current_segment:
        segments.append(current_segment.strip())
    
    # If segments are still too long, split by clauses/phrases
    final_segments = []
    for segment in segments:
        if len(segment) <= max_length:
            final_segments.append(segment)
        else:
            # Split by commas or other delimiters
            parts = re.split(r'[,;:]', segment)
            temp_segment = ""
            
            for part in parts:
                part = part.strip()
                if len(temp_segment) + len(part) <= max_length:
                    temp_segment += part + ", "
                else:
                    if temp_segment:
                        final_segments.append(temp_segment.strip().rstrip(','))
                    temp_segment = part + ", "
            
            if temp_segment:
                final_segments.append(temp_segment.strip().rstrip(','))
    
    return [seg for seg in final_segments if seg.strip()]
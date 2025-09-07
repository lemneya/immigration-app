"""
MT Provider implementations for LibreTranslate, Marian OPUS-MT, and NLLB
"""

import asyncio
import logging
import os
from abc import ABC, abstractmethod
from typing import List, Dict, Optional
import json

import httpx
import ctranslate2
import sentencepiece as spm
from transformers import AutoTokenizer
import torch

logger = logging.getLogger(__name__)

class BaseMTProvider(ABC):
    """Base class for MT providers"""
    
    def __init__(self):
        self.initialized = False
        self.supported_pairs = []
    
    @abstractmethod
    async def initialize(self):
        """Initialize the provider"""
        pass
    
    @abstractmethod
    async def translate(self, text: str, src: str, tgt: str, **options) -> str:
        """Translate single text"""
        pass
    
    @abstractmethod
    async def translate_batch(self, texts: List[str], src: str, tgt: str, **options) -> List[str]:
        """Translate batch of texts"""
        pass
    
    @abstractmethod
    async def get_supported_languages(self) -> List[Dict[str, str]]:
        """Get supported language pairs"""
        pass

class LibreTranslateProvider(BaseMTProvider):
    """LibreTranslate provider using HTTP API"""
    
    def __init__(self, url: str = "http://libre:5000"):
        super().__init__()
        self.url = url.rstrip('/')
        self.client = None
        self._supported_langs = None
    
    async def initialize(self):
        """Initialize LibreTranslate connection"""
        try:
            self.client = httpx.AsyncClient(timeout=30.0)
            
            # Test connection and get languages
            response = await self.client.get(f"{self.url}/languages")
            response.raise_for_status()
            
            languages = response.json()
            self._supported_langs = languages
            
            # Build language pairs for common immigration languages
            source_langs = ['ar', 'es', 'fr']
            target_langs = ['en']
            
            self.supported_pairs = []
            for src in source_langs:
                for tgt in target_langs + [l for l in source_langs if l != src]:
                    self.supported_pairs.append({
                        'source': src,
                        'target': tgt,
                        'name': f"{src} -> {tgt}"
                    })
            
            self.initialized = True
            logger.info(f"LibreTranslate initialized with {len(self.supported_pairs)} pairs")
            
        except Exception as e:
            logger.error(f"Failed to initialize LibreTranslate: {e}")
            raise
    
    async def translate(self, text: str, src: str, tgt: str, **options) -> str:
        """Translate single text via LibreTranslate API"""
        if not self.initialized:
            raise RuntimeError("Provider not initialized")
        
        try:
            payload = {
                "q": text,
                "source": src,
                "target": tgt,
                "format": "text"
            }
            
            response = await self.client.post(f"{self.url}/translate", json=payload)
            response.raise_for_status()
            
            result = response.json()
            return result.get("translatedText", text)
            
        except Exception as e:
            logger.error(f"LibreTranslate error: {e}")
            raise
    
    async def translate_batch(self, texts: List[str], src: str, tgt: str, **options) -> List[str]:
        """Translate batch via multiple API calls"""
        # LibreTranslate doesn't have native batch API, so we parallelize
        tasks = [self.translate(text, src, tgt, **options) for text in texts]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle exceptions
        translations = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Batch translation failed for segment {i}: {result}")
                translations.append(texts[i])  # Return original on error
            else:
                translations.append(result)
        
        return translations
    
    async def get_supported_languages(self) -> List[Dict[str, str]]:
        """Get supported language pairs"""
        return self.supported_pairs

class MarianProvider(BaseMTProvider):
    """Marian OPUS-MT provider using CTranslate2"""
    
    def __init__(self, model_dir: str = "/models", device: str = "cpu", threads: int = 4):
        super().__init__()
        self.model_dir = model_dir
        self.device = device
        self.threads = threads
        self.models = {}
        self.tokenizers = {}
    
    async def initialize(self):
        """Initialize Marian models"""
        try:
            # Common OPUS-MT models for immigration documents
            model_pairs = [
                ("ar", "en", "opus-mt-ar-en"),
                ("es", "en", "opus-mt-es-en"), 
                ("fr", "en", "opus-mt-fr-en"),
                ("en", "es", "opus-mt-en-es"),
                ("en", "fr", "opus-mt-en-fr")
            ]
            
            for src, tgt, model_name in model_pairs:
                model_path = os.path.join(self.model_dir, model_name)
                
                if os.path.exists(model_path):
                    try:
                        # Load CTranslate2 model
                        translator = ctranslate2.Translator(
                            model_path, 
                            device=self.device,
                            compute_type="int8" if self.device == "cpu" else "float16"
                        )
                        
                        # Load tokenizer
                        tokenizer = AutoTokenizer.from_pretrained(model_path)
                        
                        pair_key = f"{src}-{tgt}"
                        self.models[pair_key] = translator
                        self.tokenizers[pair_key] = tokenizer
                        
                        self.supported_pairs.append({
                            'source': src,
                            'target': tgt,
                            'name': f"{src} -> {tgt} (OPUS-MT)"
                        })
                        
                        logger.info(f"Loaded Marian model: {model_name}")
                        
                    except Exception as e:
                        logger.warning(f"Failed to load model {model_name}: {e}")
                else:
                    logger.warning(f"Model not found: {model_path}")
            
            if not self.models:
                raise RuntimeError("No Marian models loaded")
            
            self.initialized = True
            logger.info(f"Marian initialized with {len(self.models)} models")
            
        except Exception as e:
            logger.error(f"Failed to initialize Marian: {e}")
            raise
    
    async def translate(self, text: str, src: str, tgt: str, **options) -> str:
        """Translate using Marian model"""
        if not self.initialized:
            raise RuntimeError("Provider not initialized")
        
        pair_key = f"{src}-{tgt}"
        if pair_key not in self.models:
            raise ValueError(f"Language pair {pair_key} not supported")
        
        try:
            translator = self.models[pair_key]
            tokenizer = self.tokenizers[pair_key]
            
            # Tokenize
            inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
            tokens = inputs["input_ids"][0].tolist()
            
            # Translate
            results = translator.translate_batch([tokens])
            output_tokens = results[0].hypotheses[0]
            
            # Decode
            translated = tokenizer.decode(output_tokens, skip_special_tokens=True)
            return translated
            
        except Exception as e:
            logger.error(f"Marian translation error: {e}")
            raise
    
    async def translate_batch(self, texts: List[str], src: str, tgt: str, **options) -> List[str]:
        """Batch translate using Marian"""
        if not self.initialized:
            raise RuntimeError("Provider not initialized")
        
        pair_key = f"{src}-{tgt}"
        if pair_key not in self.models:
            raise ValueError(f"Language pair {pair_key} not supported")
        
        try:
            translator = self.models[pair_key]
            tokenizer = self.tokenizers[pair_key]
            
            # Tokenize all texts
            batch_tokens = []
            for text in texts:
                inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
                tokens = inputs["input_ids"][0].tolist()
                batch_tokens.append(tokens)
            
            # Batch translate
            results = translator.translate_batch(batch_tokens)
            
            # Decode all results
            translations = []
            for result in results:
                output_tokens = result.hypotheses[0]
                translated = tokenizer.decode(output_tokens, skip_special_tokens=True)
                translations.append(translated)
            
            return translations
            
        except Exception as e:
            logger.error(f"Marian batch translation error: {e}")
            raise
    
    async def get_supported_languages(self) -> List[Dict[str, str]]:
        """Get supported language pairs"""
        return self.supported_pairs

class NLLBProvider(BaseMTProvider):
    """NLLB provider using CTranslate2"""
    
    def __init__(self, model_dir: str = "/models", device: str = "cpu", threads: int = 4):
        super().__init__()
        self.model_dir = model_dir
        self.device = device  
        self.threads = threads
        self.translator = None
        self.tokenizer = None
        
        # NLLB language code mapping
        self.lang_map = {
            'ar': 'arb_Arab',  # Arabic
            'es': 'spa_Latn',  # Spanish  
            'fr': 'fra_Latn',  # French
            'en': 'eng_Latn'   # English
        }
    
    async def initialize(self):
        """Initialize NLLB model"""
        try:
            model_name = "nllb-200-1.3B"  # or nllb-200-distilled-600M for smaller
            model_path = os.path.join(self.model_dir, model_name)
            
            if not os.path.exists(model_path):
                raise RuntimeError(f"NLLB model not found at {model_path}")
            
            # Load CTranslate2 model
            self.translator = ctranslate2.Translator(
                model_path,
                device=self.device,
                compute_type="int8" if self.device == "cpu" else "float16"
            )
            
            # Load sentence piece tokenizer
            spm_path = os.path.join(model_path, "sentencepiece.model")
            self.tokenizer = spm.SentencePieceProcessor()
            self.tokenizer.load(spm_path)
            
            # Build supported pairs
            languages = ['ar', 'es', 'fr', 'en']
            for src in languages:
                for tgt in languages:
                    if src != tgt:
                        self.supported_pairs.append({
                            'source': src,
                            'target': tgt,
                            'name': f"{src} -> {tgt} (NLLB-200)"
                        })
            
            self.initialized = True
            logger.info(f"NLLB initialized with {len(self.supported_pairs)} pairs")
            
        except Exception as e:
            logger.error(f"Failed to initialize NLLB: {e}")
            raise
    
    async def translate(self, text: str, src: str, tgt: str, **options) -> str:
        """Translate using NLLB model"""
        if not self.initialized:
            raise RuntimeError("Provider not initialized")
        
        try:
            # Map language codes
            src_lang = self.lang_map.get(src, src)
            tgt_lang = self.lang_map.get(tgt, tgt)
            
            # Tokenize with language prefix
            prompt = f"{src_lang} {text}"
            tokens = self.tokenizer.encode(prompt, out_type=int)
            
            # Translate
            target_prefix = [self.tokenizer.piece_to_id(tgt_lang)]
            results = self.translator.translate_batch(
                [tokens],
                target_prefix=[target_prefix]
            )
            
            # Decode
            output_tokens = results[0].hypotheses[0]
            translated = self.tokenizer.decode(output_tokens)
            
            # Remove language prefix
            if translated.startswith(tgt_lang):
                translated = translated[len(tgt_lang):].strip()
            
            return translated
            
        except Exception as e:
            logger.error(f"NLLB translation error: {e}")
            raise
    
    async def translate_batch(self, texts: List[str], src: str, tgt: str, **options) -> List[str]:
        """Batch translate using NLLB"""
        if not self.initialized:
            raise RuntimeError("Provider not initialized")
        
        try:
            # Map language codes
            src_lang = self.lang_map.get(src, src)
            tgt_lang = self.lang_map.get(tgt, tgt)
            
            # Tokenize all texts
            batch_tokens = []
            target_prefix = [self.tokenizer.piece_to_id(tgt_lang)]
            
            for text in texts:
                prompt = f"{src_lang} {text}"
                tokens = self.tokenizer.encode(prompt, out_type=int)
                batch_tokens.append(tokens)
            
            # Batch translate
            results = self.translator.translate_batch(
                batch_tokens,
                target_prefix=[target_prefix] * len(batch_tokens)
            )
            
            # Decode all results
            translations = []
            for result in results:
                output_tokens = result.hypotheses[0]
                translated = self.tokenizer.decode(output_tokens)
                
                # Remove language prefix
                if translated.startswith(tgt_lang):
                    translated = translated[len(tgt_lang):].strip()
                
                translations.append(translated)
            
            return translations
            
        except Exception as e:
            logger.error(f"NLLB batch translation error: {e}")
            raise
    
    async def get_supported_languages(self) -> List[Dict[str, str]]:
        """Get supported language pairs"""
        return self.supported_pairs
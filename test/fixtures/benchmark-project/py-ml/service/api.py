"""
FastAPI-style controller coordinating feature extraction, model inference, and timing decorators.
"""

import asyncio
import functools
import time
from typing import Callable, Any, Dict, List
from .schemas import PredictionRequest, PredictionResult, ScoredLabel
from .feature_extract import FeatureExtractor
from .inference import ModelInferenceEngine


def timed_execution(func: Callable[..., Any]) -> Callable[..., Any]:
    """Decorator to measure and inject execution latency."""
    @functools.wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        start_time = time.perf_counter()
        result = await func(*args, **kwargs)
        duration_ms = (time.perf_counter() - start_time) * 1000.0
        if isinstance(result, PredictionResult):
            result.latency_ms = round(duration_ms, 2)
        return result
    return wrapper


class ModelServiceController:
    """Entry point service controller handling incoming prediction requests."""

    def __init__(self, model_name: str = "nlp-intent-v2"):
        """
        Initialize controller with extractors and model engines.
        """
        self.model_name = model_name
        self.extractor = FeatureExtractor(vocab_size=500)
        self.engine = ModelInferenceEngine(
            model_name=model_name,
            labels=["billing_query", "tech_support", "account_update", "refund_request", "general_inquiry"]
        )
        self._warmup()

    def _warmup(self) -> None:
        """Initialize baseline vocabulary and weights."""
        corpus = [
            "I need help with my monthly billing invoice and credit card charge",
            "Technical error occurred while logging into account dashboard",
            "Can I get a refund for my last subscription renewal fee",
            "Please update my shipping address and phone number on file",
            "What are your business hours and contact phone numbers"
        ]
        self.extractor.fit_vocabulary(corpus)
        self.engine.initialize_synthetic_weights(len(self.extractor.vocabulary))

    @timed_execution
    async def predict_single(self, request: PredictionRequest) -> PredictionResult:
        """
        Handle single prediction request asynchronously.

        :param request: PredictionRequest
        :return: PredictionResult
        """
        if not request.text or len(request.text.strip()) == 0:
            raise ValueError("Prediction text must not be empty.")

        # Simulate async I/O or token processing
        await asyncio.sleep(0.001)

        features = self.extractor.extract_features(request.text)
        predictions = self.engine.predict_top_k(features, k=request.top_k)

        req_id = request.request_id or f"req_{int(time.time() * 1000)}"
        return PredictionResult(
            request_id=req_id,
            predictions=predictions,
            latency_ms=0.0,
            model_version=self.engine.version,
            features_extracted=features.dim
        )

    async def predict_batch(self, requests: List[PredictionRequest]) -> List[PredictionResult]:
        """
        Process multiple requests concurrently using asyncio.gather.

        :param requests: List of PredictionRequest
        :return: List of PredictionResult
        """
        tasks = [self.predict_single(req) for req in requests]
        return await asyncio.gather(*tasks)

    def health_check(self) -> Dict[str, Any]:
        """Return operational health status."""
        return {
            "status": "healthy",
            "model_name": self.model_name,
            "vocab_size": len(self.extractor.vocabulary),
            "labels": self.engine.labels
        }

"""
Data models and serialization schemas for machine learning pipeline.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any
import time


class ModelType(str, Enum):
    CLASSIFIER = "classifier"
    REGRESSOR = "regressor"
    EMBEDDING = "embedding"


class NormalizationType(str, Enum):
    MIN_MAX = "min_max"
    Z_SCORE = "z_score"
    L2 = "l2"


@dataclass
class FeatureVector:
    """Represents an extracted numerical feature vector with metadata."""
    feature_names: List[str]
    values: List[float]
    dim: int = field(init=False)
    timestamp: float = field(default_factory=time.time)

    def __post_init__(self) -> None:
        self.dim = len(self.values)

    def to_dict(self) -> Dict[str, float]:
        """Convert feature vector to dictionary mapping name to value."""
        return dict(zip(self.feature_names, self.values))


@dataclass
class PredictionRequest:
    """Incoming prediction payload."""
    text: str
    model_name: str
    top_k: int = 3
    parameters: Dict[str, Any] = field(default_factory=dict)
    request_id: Optional[str] = None


@dataclass
class ScoredLabel:
    """Single scored classification category."""
    label: str
    score: float
    confidence: float


@dataclass
class PredictionResult:
    """Model inference output containing top predictions and latency."""
    request_id: str
    predictions: List[ScoredLabel]
    latency_ms: float
    model_version: str
    features_extracted: int

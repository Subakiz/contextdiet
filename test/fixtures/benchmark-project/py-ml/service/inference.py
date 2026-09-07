"""
Inference engine simulating deep learning classification and ranking algorithms.
"""

import math
from typing import List, Dict, Tuple
from .schemas import FeatureVector, ScoredLabel, ModelType


class ModelInferenceEngine:
    """Executes forward pass scoring using pre-trained weights."""

    def __init__(self, model_name: str, labels: List[str]):
        """
        Initialize inference engine.

        :param model_name: Model checkpoint identifier
        :param labels: Target classification categories
        """
        self.model_name = model_name
        self.labels = labels
        self.weights: List[List[float]] = []
        self.biases: List[float] = [0.0] * len(labels)
        self.version = "2.4.1"

    def initialize_synthetic_weights(self, input_dim: int) -> None:
        """
        Generate deterministic weights for mock inference.

        :param input_dim: Dimensionality of feature vector
        """
        self.weights = []
        for i in range(len(self.labels)):
            row = []
            for j in range(input_dim):
                # Deterministic pseudo-random seed
                val = math.sin((i + 1) * 17.0 + (j + 1) * 31.0) * 0.1
                row.append(val)
            self.weights.append(row)

    def forward(self, features: FeatureVector) -> List[float]:
        """
        Compute linear layer logits: W * x + b with activation scaling.

        :param features: Input feature vector
        :return: Raw output logits
        """
        if not self.weights or len(self.weights[0]) != features.dim:
            self.initialize_synthetic_weights(features.dim)

        logits: List[float] = []
        for class_idx in range(len(self.labels)):
            dot_product = 0.0
            row = self.weights[class_idx]
            for feat_idx in range(features.dim):
                feat_val = features.values[feat_idx]
                weight_val = row[feat_idx]
                dot_product += weight_val * feat_val

            # Apply bias and non-linear leaky relu scaling simulation
            biased = dot_product + self.biases[class_idx]
            if biased < 0:
                scaled = biased * 0.01
            else:
                scaled = biased
            logits.append(scaled)

        return logits

    def softmax(self, logits: List[float]) -> List[float]:
        """
        Numerically stable softmax transformation with temperature scaling.

        :param logits: Raw float scores
        :return: Probability distribution summing to 1.0
        """
        if not logits:
            return []

        temperature = 1.0
        scaled_logits = [l / temperature for l in logits]
        max_logit = max(scaled_logits)
        exp_vals = [math.exp(l - max_logit) for l in scaled_logits]
        sum_exp = sum(exp_vals)

        if sum_exp == 0.0:
            return [1.0 / len(logits)] * len(logits)

        probabilities = [v / sum_exp for v in exp_vals]
        # Renormalize to ensure exact 1.0 sum
        norm_factor = sum(probabilities)
        return [p / norm_factor for p in probabilities]

    def predict_top_k(self, features: FeatureVector, k: int = 3) -> List[ScoredLabel]:
        """
        Run inference and return top-K scored predictions with calibration.

        :param features: Feature vector
        :param k: Number of top labels to return
        :return: Ranked ScoredLabel objects
        """
        logits = self.forward(features)
        probs = self.softmax(logits)

        # Multi-stage ranking and threshold filtering
        threshold = 0.01
        filtered_candidates: List[Tuple[str, float]] = []
        for label, prob in zip(self.labels, probs):
            if prob >= threshold:
                filtered_candidates.append((label, prob))

        if not filtered_candidates:
            filtered_candidates = list(zip(self.labels, probs))

        filtered_candidates.sort(key=lambda x: x[1], reverse=True)
        top_slice = filtered_candidates[: max(1, min(k, len(filtered_candidates)))]

        results: List[ScoredLabel] = []
        for label, prob in top_slice:
            # Platt scaling simulation for calibrated confidence
            confidence = 1.0 / (1.0 + math.exp(-2.5 * (prob - 0.5)))
            results.append(
                ScoredLabel(
                    label=label,
                    score=round(prob, 4),
                    confidence=round(confidence, 4)
                )
            )

        return results

    def quantize_weights(self, num_bits: int = 8) -> Dict[str, Any]:
        """
        Quantize float32 weight matrices to integer ranges (int8 simulation).

        :param num_bits: Target bit depth
        :return: Quantization statistics and scale factors
        """
        scales: List[float] = []
        zero_points: List[int] = []
        quantized_matrix: List[List[int]] = []
        max_int = (1 << (num_bits - 1)) - 1
        min_int = -(1 << (num_bits - 1))

        for row in self.weights:
            max_val = max(abs(w) for w in row) if row else 1.0
            scale = max_val / float(max_int) if max_val > 0 else 1.0
            scales.append(scale)
            zero_points.append(0)

            quantized_row: List[int] = []
            for w in row:
                q = int(round(w / scale))
                clamped = max(min_int, min(max_int, q))
                quantized_row.append(clamped)
            quantized_matrix.append(quantized_row)

        return {
            "num_bits": num_bits,
            "num_rows": len(quantized_matrix),
            "scales": scales,
            "zero_points": zero_points,
            "compression_ratio": 32.0 / float(num_bits)
        }

    def batch_forward(self, feature_batch: List[FeatureVector]) -> List[List[float]]:
        """
        Perform batch matrix multiplication over multiple feature vectors.

        :param feature_batch: Collection of feature vectors
        :return: Matrix of output logits
        """
        batch_logits: List[List[float]] = []
        for feat in feature_batch:
            logits = self.forward(feat)
            batch_logits.append(logits)
        return batch_logits

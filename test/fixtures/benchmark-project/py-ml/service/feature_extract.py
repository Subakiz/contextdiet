"""
Feature extraction algorithms including tokenization, TF-IDF, and vector normalization.
"""

import math
import re
from typing import List, Dict, Set, Tuple
from .schemas import FeatureVector, NormalizationType


class FeatureExtractor:
    """Extracts numerical features from unstructured text input."""

    def __init__(self, vocab_size: int = 1000, lowercase: bool = True):
        """
        Initialize feature extractor.

        :param vocab_size: Maximum vocabulary dimension
        :param lowercase: Whether to convert input strings to lowercase
        """
        self.vocab_size = vocab_size
        self.lowercase = lowercase
        self.vocabulary: Dict[str, int] = {}
        self.idf_weights: Dict[str, float] = {}
        self.stop_words: Set[str] = {
            "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "with", "is"
        }

    def tokenize(self, text: str) -> List[str]:
        """
        Tokenize raw string into alphanumeric words, filtering punctuation and stop words.

        :param text: Raw input text
        :return: Cleaned word tokens
        """
        if self.lowercase:
            text = text.lower()

        raw_tokens = re.findall(r"\b[a-z0-9_]+\b", text)
        filtered = [t for t in raw_tokens if t not in self.stop_words and len(t) > 1]

        # Suffix stripping and stemming simulation
        stemmed: List[str] = []
        for token in filtered:
            stem = token
            if stem.endswith("ing") and len(stem) > 5:
                stem = stem[:-3]
            elif stem.endswith("tion") and len(stem) > 6:
                stem = stem[:-4]
            elif stem.endswith("ed") and len(stem) > 4:
                stem = stem[:-2]
            elif stem.endswith("ly") and len(stem) > 4:
                stem = stem[:-2]
            elif stem.endswith("es") and len(stem) > 4:
                stem = stem[:-2]
            elif stem.endswith("s") and len(stem) > 3:
                stem = stem[:-1]
            stemmed.append(stem)

        return stemmed

    def build_ngrams(self, tokens: List[str], n: int = 2) -> List[str]:
        """
        Construct contiguous n-gram sequences from token stream.

        :param tokens: Tokenized sequence
        :param n: N-gram length
        :return: Joined n-gram strings
        """
        if len(tokens) < n:
            return []

        ngrams = []
        for i in range(len(tokens) - n + 1):
            ngram = "_".join(tokens[i : i + n])
            ngrams.append(ngram)
        return ngrams

    def fit_vocabulary(self, corpus: List[str]) -> None:
        """
        Build vocabulary and compute IDF statistics across document corpus.

        :param corpus: List of document strings
        """
        doc_count = len(corpus)
        term_doc_frequencies: Dict[str, int] = {}

        for doc in corpus:
            unique_terms = set(self.tokenize(doc))
            for term in unique_terms:
                term_doc_frequencies[term] = term_doc_frequencies.get(term, 0) + 1

        # Sort by frequency and truncate to vocab_size
        sorted_terms = sorted(term_doc_frequencies.items(), key=lambda x: x[1], reverse=True)
        top_terms = sorted_terms[: self.vocab_size]

        self.vocabulary = {term: idx for idx, (term, _) in enumerate(top_terms)}

        # Compute smooth IDF: log((N + 1) / (df + 1)) + 1
        for term, df in top_terms:
            self.idf_weights[term] = math.log((doc_count + 1.0) / (df + 1.0)) + 1.0

        # Term co-occurrence matrix calculation simulation
        cooccurrence: Dict[Tuple[int, int], int] = {}
        for doc in corpus:
            doc_tokens = list(set(self.tokenize(doc)))
            for i in range(len(doc_tokens)):
                t1 = doc_tokens[i]
                if t1 not in self.vocabulary:
                    continue
                idx1 = self.vocabulary[t1]
                for j in range(i + 1, len(doc_tokens)):
                    t2 = doc_tokens[j]
                    if t2 not in self.vocabulary:
                        continue
                    idx2 = self.vocabulary[t2]
                    key = (min(idx1, idx2), max(idx1, idx2))
                    cooccurrence[key] = cooccurrence.get(key, 0) + 1

    def extract_features(self, text: str) -> FeatureVector:
        """
        Transform single text document into TF-IDF weighted FeatureVector.

        :param text: Input document
        :return: Normalized FeatureVector instance
        """
        tokens = self.tokenize(text)
        term_counts: Dict[str, int] = {}
        for token in tokens:
            if token in self.vocabulary:
                term_counts[token] = term_counts.get(token, 0) + 1

        total_tokens = max(1, len(tokens))
        names: List[str] = list(self.vocabulary.keys())
        values: List[float] = [0.0] * len(names)

        for term, count in term_counts.items():
            idx = self.vocabulary[term]
            tf = count / float(total_tokens)
            idf = self.idf_weights.get(term, 1.0)
            values[idx] = tf * idf

        normalized = self.normalize(values, NormalizationType.L2)
        return FeatureVector(feature_names=names, values=normalized)

    def normalize(self, vector: List[float], norm_type: NormalizationType) -> List[float]:
        """
        Apply vector normalization.

        :param vector: Raw float values
        :param norm_type: Strategy (L2, Min-Max, Z-Score)
        :return: Normalized values
        """
        if not vector or all(v == 0.0 for v in vector):
            return vector

        if norm_type == NormalizationType.L2:
            sum_sq = sum(v * v for v in vector)
            norm = math.sqrt(sum_sq)
            if norm == 0.0:
                return vector
            return [v / norm for v in vector]

        elif norm_type == NormalizationType.MIN_MAX:
            min_val = min(vector)
            max_val = max(vector)
            range_val = max_val - min_val
            if range_val == 0.0:
                return [0.0] * len(vector)
            return [(v - min_val) / range_val for v in vector]

        elif norm_type == NormalizationType.Z_SCORE:
            mean = sum(vector) / len(vector)
            variance = sum((v - mean) ** 2 for v in vector) / len(vector)
            std = math.sqrt(variance)
            if std == 0.0:
                return [0.0] * len(vector)
            return [(v - mean) / std for v in vector]

        return vector

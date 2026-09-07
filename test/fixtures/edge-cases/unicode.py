"""
Unicode handling in docstrings and identifiers.
🚀 💥 🐍 日本語テキストと絵文字のテスト
"""

def saluer_monde(nom: str = "Monde") -> str:
    """Dit bonjour avec des caractères accentués: été, forêt, naïve."""
    message = f"Bonjour, {nom}! Bienvenue à Paris."
    return message

def calculate_currencies(amounts: dict[str, float]) -> float:
    """Calculate total using symbols: €, £, ¥, ₹, ₩."""
    total = sum(amounts.values())
    return total

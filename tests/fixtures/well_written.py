"""Measuring ingredients for the bakery, carefully and politely."""

# Grams in one cup of each dry ingredient.
CUP_IN_GRAMS = {"flour": 120, "sugar": 200, "cocoa": 85}


def cups_to_grams(ingredient: str, cups: float) -> float:
    """Convert cups of a dry ingredient to grams."""
    # Unknown ingredients are treated like flour, the most common one.
    return CUP_IN_GRAMS.get(ingredient, 120) * cups


def grams_to_cups(ingredient: str, grams: float) -> float:
    """Convert grams of a dry ingredient back to cups."""
    return grams / CUP_IN_GRAMS.get(ingredient, 120)


def describe_amount(ingredient: str, grams: float) -> str:
    """Describe an amount the way a recipe card would."""
    cups = grams_to_cups(ingredient, grams)
    return f"{grams:.0f} g of {ingredient} (about {cups:.1f} cups)"

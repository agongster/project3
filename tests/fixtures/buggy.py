"""A tiny shop module with exactly three known problems (see tests/analysis/ruff.test.ts)."""

import os


def add_topping(topping: str, toppings: list[str] = []) -> list[str]:
    """Add a topping to the order."""
    toppings.append(topping)
    return toppings


def secret_sauce(expression: str) -> int:
    """Evaluate the chef's secret sauce formula."""
    return eval(expression)

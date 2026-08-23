from __future__ import annotations
"""
Shared dataclass for LaTeX template configuration.
Kept in a separate module to avoid circular imports
(latex_generator.py imports templates/* which import this).
"""
from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class TemplateConfig:
    template_id: str
    font_size: int                                # LaTeX document font size in pt
    margins: Tuple[float, float, float, float]    # (top, bottom, left, right) in inches
    section_style: str                            # Controls \titleformat
    bullet_char: str                              # LaTeX bullet: r"\textbullet" or r"$\circ$"
    accent_rgb: Optional[Tuple[int, int, int]] = None  # None = monochrome
    glyphtounicode: bool = False                  # Adds \usepackage{glyphtounicode} + \pdfgentounicode=1
    font_setup: str = ""                          # Raw preamble lines for font packages ("" = Computer Modern)
    header_style: str = "centered"                # "centered" | "left_large" | "centered_sc"

from __future__ import annotations
from generators.latex_generator import TemplateConfig

CONFIG = TemplateConfig(
    template_id="executive",
    font_size=10,
    margins=(0.5, 0.4, 0.6, 0.6),
    section_style="sc_accent_rule",
    bullet_char=r"\textbullet",
    accent_rgb=(31, 58, 95),  # Deep navy
    font_setup=r"\usepackage{charter}",
    header_style="centered_sc",
)

from __future__ import annotations
from generators.latex_generator import TemplateConfig

CONFIG = TemplateConfig(
    template_id="crimson",
    font_size=10,
    margins=(0.5, 0.4, 0.6, 0.6),
    section_style="sc_accent_rule",
    bullet_char=r"\textbullet",
    accent_rgb=(136, 19, 55),  # Burgundy
    font_setup=r"\usepackage{newtxtext}",
    header_style="centered",
)

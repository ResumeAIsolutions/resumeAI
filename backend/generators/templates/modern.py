from __future__ import annotations
from generators.latex_generator import TemplateConfig

CONFIG = TemplateConfig(
    template_id="modern",
    font_size=10,
    margins=(0.6, 0.2, 1.0, 1.0),
    section_style="modern_green",
    bullet_char=r"\textbullet",
    accent_rgb=(68, 149, 162),   # Teal #4495A2 from Microsoft template
)

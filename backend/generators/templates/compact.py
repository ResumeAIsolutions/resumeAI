from __future__ import annotations
from generators.latex_generator import TemplateConfig

CONFIG = TemplateConfig(
    template_id="compact",
    font_size=10,
    margins=(0.35, 0.3, 0.45, 0.45),
    section_style="uppercase_rule",
    bullet_char=r"\textbullet",
    accent_rgb=None,
    font_setup="\\usepackage[T1]{fontenc}\n\\usepackage{lmodern}",
    header_style="centered",
)

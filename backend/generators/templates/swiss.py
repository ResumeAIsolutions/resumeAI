from __future__ import annotations
from generators.latex_generator import TemplateConfig

CONFIG = TemplateConfig(
    template_id="swiss",
    font_size=10,
    margins=(0.7, 0.5, 0.8, 0.8),
    section_style="swiss_plain",
    bullet_char=r"\textendash",
    accent_rgb=(107, 114, 128),  # Neutral gray section labels
    font_setup="\\usepackage[T1]{fontenc}\n\\usepackage[default]{sourcesanspro}",
    header_style="left_large",
)

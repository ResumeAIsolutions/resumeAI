from __future__ import annotations
from generators.latex_generator import TemplateConfig

CONFIG = TemplateConfig(
    template_id="tech",
    font_size=10,
    margins=(0.5, 0.4, 0.7, 0.7),
    section_style="colored_bar",
    bullet_char=r"\textbullet",
    accent_rgb=(37, 99, 235),  # Vivid blue
    font_setup="\\usepackage[T1]{fontenc}\n\\usepackage{helvet}\n\\renewcommand{\\familydefault}{\\sfdefault}",
    header_style="left_large",
)

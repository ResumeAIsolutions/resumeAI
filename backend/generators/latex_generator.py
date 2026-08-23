from __future__ import annotations
"""
LaTeX resume generator — mirrors the DOCX generator structure exactly.
Centered header, ruled uppercase section headers, two-column entry lines, bullet lists.
"""

import io
import logging
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request
import platform
from typing import Dict, Optional, Tuple, List

from generators.latex_templates import TemplateConfig

def _build_registry() -> Dict[str, TemplateConfig]:
    from generators.templates import jake, modern, soham, overleaf, executive, tech, swiss, crimson, compact
    return {t.CONFIG.template_id: t.CONFIG for t in [jake, modern, soham, overleaf, executive, tech, swiss, crimson, compact]}

_TEMPLATE_REGISTRY: Dict[str, TemplateConfig] = _build_registry()
VALID_TEMPLATES = frozenset(_TEMPLATE_REGISTRY.keys())

logger = logging.getLogger(__name__)

_TECTONIC_VERSION = "0.15.0"

def _get_tectonic_url() -> str:
    system = platform.system().lower()
    machine = platform.machine().lower()
    base = f"https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40{_TECTONIC_VERSION}/"

    if system == "darwin":
        if machine in ("arm64", "aarch64"):
            return f"{base}tectonic-{_TECTONIC_VERSION}-aarch64-apple-darwin.tar.gz"
        return f"{base}tectonic-{_TECTONIC_VERSION}-x86_64-apple-darwin.tar.gz"
    
    # Default to Linux x86_64
    return f"{base}tectonic-{_TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz"


_BIN_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "bin"))
_TECTONIC_BIN = os.path.join(_BIN_DIR, "tectonic")


def _get_tectonic() -> str:
    """Return path to tectonic binary, downloading it if necessary."""
    # 1. Already on PATH
    found = shutil.which("tectonic")
    if found:
        return found
    # 2. Previously downloaded to backend/bin/
    if os.path.exists(_TECTONIC_BIN):
        return _TECTONIC_BIN
    # 3. macOS Homebrew (common locations)
    for p in ["/opt/homebrew/bin/tectonic", "/usr/local/bin/tectonic"]:
        if os.path.exists(p):
            return p

    # 4. Download and cache in backend/bin/
    url = _get_tectonic_url()
    logger.info("tectonic not found — downloading %s", url)
    os.makedirs(_BIN_DIR, exist_ok=True)
    try:
        with urllib.request.urlopen(url, timeout=120) as resp:
            data = resp.read()
        with tarfile.open(fileobj=io.BytesIO(data)) as tar:
            tar.extractall(_BIN_DIR)
        os.chmod(_TECTONIC_BIN, 0o755)
        logger.info("tectonic downloaded to %s", _TECTONIC_BIN)
        return _TECTONIC_BIN
    except Exception as e:
        raise RuntimeError(f"Could not download tectonic: {e}")


# ---------------------------------------------------------------------------
# LaTeX character escaping
# ---------------------------------------------------------------------------

_LATEX_SPECIAL = {
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
    "\\": r"\textbackslash{}",
}


def _esc(text: str) -> str:
    if not text:
        return ""
    # Unicode dashes → TeX ligatures (T1-encoded fonts like helvet/lmodern drop the raw glyphs)
    result = text.replace("—", "---").replace("–", "--")
    result = result.replace("\\", r"\textbackslash{}")
    for char, replacement in _LATEX_SPECIAL.items():
        if char != "\\":
            result = result.replace(char, replacement)
    return result


def _esc_url(url: str) -> str:
    return url.replace("%", r"\%")


# ---------------------------------------------------------------------------
# Apply accepted bullet choices to structured resume
# ---------------------------------------------------------------------------

def _apply_bullets(resume_structured: dict, accepted_bullets: Dict[str, str]) -> dict:
    import copy
    result = copy.deepcopy(resume_structured)
    for section in result.get("sections", []):
        for entry in section.get("entries", []):
            for bullet in entry.get("bullets", []):
                bid = bullet["bullet_id"]
                if bid in accepted_bullets and accepted_bullets[bid] != "original":
                    bullet["text"] = accepted_bullets[bid]
    return result


# ---------------------------------------------------------------------------
# Entry field extractor (mirrors docx_generator._get_entry_fields)
# ---------------------------------------------------------------------------

_DATE_PAT = re.compile(
    r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}"
    r"|(?:\d{4})\s*[-–]\s*(?:\d{4}|Present|present|Current|current)"
    r"|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}"
    r"\s*[-–]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}"
    r"|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}"
    r"\s*[-–]\s*(?:Present|present|Current|current))"
)


def _split_dates(text: str) -> tuple[str, str]:
    """Extract trailing date range from text, return (text_without_dates, dates)."""
    m = _DATE_PAT.search(text)
    if m:
        dates = text[m.start():].strip()
        before = text[:m.start()].strip().rstrip("|–- ").strip()
        return before, dates
    return text.strip(), ""


def _get_entry_fields(entry: dict) -> dict:
    company = entry.get("company", "")
    role = entry.get("role", "")
    location = entry.get("location", "")
    dates = entry.get("dates", "")

    # If company already has everything structured, use as-is
    if company and (role or dates):
        return {"company": company, "role": role, "location": location, "dates": dates}

    # Try to parse from header or combined company field
    raw = company or entry.get("header", "")
    if not raw:
        return {"company": "", "role": role, "location": location, "dates": dates}

    # Split by pipe or newline into parts
    if "\n" in raw:
        parts = [p.strip() for p in raw.split("\n") if p.strip()]
    elif "|" in raw:
        parts = [p.strip() for p in raw.split("|") if p.strip()]
    else:
        parts = [raw.strip()]

    # Extract dates from the last part or trailing of any part
    if not dates:
        last = parts[-1] if parts else ""
        cleaned, dates = _split_dates(last)
        if dates and cleaned != last:
            parts[-1] = cleaned
            if not parts[-1]:
                parts.pop()

    if len(parts) >= 2:
        company = parts[0].strip()
        role = role or parts[1].strip()
    elif parts:
        # Single part — try to split role from company if no dates yet
        company = parts[0].strip()

    return {"company": company, "role": role, "location": location, "dates": dates}


# ---------------------------------------------------------------------------
# Section renderers — match DOCX structure exactly
# ---------------------------------------------------------------------------

def _render_header(resume: dict, cfg: Optional[TemplateConfig] = None) -> str:
    name = _esc(resume.get("name", ""))
    title = _esc(resume.get("title", ""))
    contact = resume.get("contact", {})
    location = _esc(contact.get("location", ""))
    phone = _esc(contact.get("phone", ""))
    email = contact.get("email", "")
    linkedin = contact.get("linkedin", "")
    github = contact.get("github", "")
    portfolio = contact.get("portfolio", "")

    # Build contact parts (shared across all styles)
    contact_parts = []
    if phone:
        contact_parts.append(phone)
    if email:
        contact_parts.append(
            r"\href{mailto:" + _esc_url(email) + r"}{\underline{" + _esc(email) + r"}}"
        )
    if linkedin:
        url = linkedin if linkedin.startswith("http") else "https://" + linkedin
        display = linkedin.replace("https://", "").replace("http://", "")
        contact_parts.append(
            r"\href{" + _esc_url(url) + r"}{\underline{" + _esc(display) + r"}}"
        )
    if github:
        url = github if github.startswith("http") else "https://" + github
        display = github.replace("https://", "").replace("http://", "")
        contact_parts.append(
            r"\href{" + _esc_url(url) + r"}{\underline{" + _esc(display) + r"}}"
        )
    if portfolio:
        url = portfolio if portfolio.startswith("http") else "https://" + portfolio
        display = portfolio.replace("https://", "").replace("http://", "")
        contact_parts.append(
            r"\href{" + _esc_url(url) + r"}{\underline{" + _esc(display) + r"}}"
        )

    # Left-aligned large name, contact on next line
    if cfg and cfg.header_style == "left_large":
        lines = []
        lines.append(r"{\nametext{" + name + r"}} \\[6pt]")
        if title:
            lines.append(r"{\small " + title + r"} \\[2pt]")
        if location:
            lines.append(r"{\small " + location + r"} \\[2pt]")
        if contact_parts:
            lines.append(r"{\small " + r" $|$ ".join(contact_parts) + r"}")
        lines.append(r"\vspace{6pt}")
        return "\n".join(lines)

    # Default: centered header
    lines = [r"\begin{center}"]
    lines.append(r"    {\nametext{" + name + r"}} \\[2pt]")
    if title:
        lines.append(r"    " + title + r" \\[1pt]")
    if location:
        lines.append(r"    " + location + r" \\[1pt]")
    if contact_parts:
        lines.append(r"    \small " + r" $|$ ".join(contact_parts) + r" \\")
    lines.append(r"\end{center}")
    return "\n".join(lines)


def _render_summary(resume: dict) -> str:
    summary = resume.get("summary", "")
    if not summary:
        return ""
    return "\n".join([
        r"\section{PROFESSIONAL SUMMARY}",
        r"\small " + _esc(summary),
    ])


def _render_two_col(left: str, right: str, left_fmt: str = "bold") -> str:
    """Render a line with left text and right-aligned text (mirrors DOCX _add_two_column_line)."""
    if left_fmt == "bold":
        left_tex = r"\textbf{" + left + r"}"
    elif left_fmt == "italic":
        left_tex = r"\textit{\small " + left + r"}"
    else:
        left_tex = left

    if right:
        return left_tex + r" \hfill " + right + r" \\"
    return left_tex + r" \\"


def _render_experience(section: dict) -> str:
    lines = [r"\section{WORK EXPERIENCE}", ""]
    for entry in section.get("entries", []):
        fields = _get_entry_fields(entry)
        company = _esc(fields["company"])
        role = _esc(fields["role"])
        location = _esc(fields["location"])
        dates = _esc(fields["dates"])

        # Company bold + location right (matches DOCX)
        lines.append(_render_two_col(company, location, left_fmt="bold"))

        # Role italic + dates right (matches DOCX)
        if role or dates:
            lines.append(_render_two_col(role, dates, left_fmt="italic"))

        # Bullets
        bullets = [b for b in entry.get("bullets", []) if b.get("text", "").strip()]
        if bullets:
            lines.append(r"\begin{itemize}")
            for b in bullets:
                lines.append(r"    \item " + _esc(b["text"].strip()))
            lines.append(r"\end{itemize}")

        lines.append("")

    return "\n".join(lines)


def _render_education(section: dict) -> str:
    lines = [r"\section{EDUCATION}", ""]
    for entry in section.get("entries", []):
        fields = _get_entry_fields(entry)
        school = _esc(fields["company"])
        degree = _esc(fields["role"])
        dates = _esc(fields["dates"])

        # School bold + dates right (matches DOCX)
        lines.append(_render_two_col(school, dates, left_fmt="bold"))

        if degree:
            lines.append(degree + r" \\")

        for b in entry.get("bullets", []):
            text = b.get("text", "").strip()
            if text:
                lines.append(_esc(text) + r" \\")

        lines.append("")

    return "\n".join(lines)


def _render_projects(section: dict) -> str:
    lines = [r"\section{PROJECTS}", ""]
    for entry in section.get("entries", []):
        fields = _get_entry_fields(entry)
        name = _esc(fields["company"] or entry.get("header", ""))
        stack = _esc(fields["role"])
        dates = _esc(fields["dates"])

        if stack:
            left = r"\textbf{" + name + r"} $|$ \textit{" + stack + r"}"
        else:
            left = r"\textbf{" + name + r"}"

        if dates:
            lines.append(left + r" \hfill " + dates + r" \\")
        else:
            lines.append(left + r" \\")

        bullets = [b for b in entry.get("bullets", []) if b.get("text", "").strip()]
        if bullets:
            lines.append(r"\begin{itemize}")
            for b in bullets:
                lines.append(r"    \item " + _esc(b["text"].strip()))
            lines.append(r"\end{itemize}")

        lines.append("")

    return "\n".join(lines)


_SKILLS_SKIP = {"technical skills", "skills", "core competencies", "competencies"}


def _render_skill_line(text: str) -> str:
    if ":" in text:
        cat, _, items = text.partition(":")
        return r"\textbf{" + _esc(cat.strip()) + r":} " + _esc(items.strip()) + r" \\"
    return _esc(text) + r" \\"


def _render_skills(section: dict) -> str:
    lines = [r"\section{TECHNICAL SKILLS}", ""]
    for entry in section.get("entries", []):
        for b in entry.get("bullets", []):
            text = b.get("text", "").strip()
            if text and text.lower() not in _SKILLS_SKIP:
                lines.append(_render_skill_line(text))

        if not entry.get("bullets"):
            header = (entry.get("header", "") or entry.get("company", "")).strip()
            if header and header.lower() not in _SKILLS_SKIP:
                lines.append(_render_skill_line(header))

    return "\n".join(lines)


def _render_certifications(section: dict) -> str:
    certs = []
    for entry in section.get("entries", []):
        header = (entry.get("company", "") or entry.get("header", "")).strip()
        if header:
            certs.append(_esc(header))
        for b in entry.get("bullets", []):
            text = b.get("text", "").strip()
            if text:
                certs.append(_esc(text))

    if not certs:
        return ""

    return "\n".join([
        r"\section{CERTIFICATIONS}",
        ", ".join(certs),
    ])


def _render_generic_section(section: dict) -> str:
    title = _esc(section.get("title", "Section")).upper()
    lines = [r"\section{" + title + r"}", ""]
    for entry in section.get("entries", []):
        header = (entry.get("header", "") or entry.get("company", "")).strip()
        if header:
            lines.append(r"\textbf{" + _esc(header) + r"} \\")

        bullets = [b for b in entry.get("bullets", []) if b.get("text", "").strip()]
        if bullets:
            lines.append(r"\begin{itemize}")
            for b in bullets:
                lines.append(r"    \item " + _esc(b["text"].strip()))
            lines.append(r"\end{itemize}")

        lines.append("")

    return "\n".join(lines)


def _build_preamble(cfg: TemplateConfig) -> str:
    top, bot, left, right = cfg.margins
    lines = [
        rf"\documentclass[{cfg.font_size}pt,letterpaper]{{article}}",
        rf"\usepackage[top={top}in,bottom={bot}in,left={left}in,right={right}in]{{geometry}}",
        r"\usepackage{titlesec}",
        r"\usepackage{enumitem}",
        r"\usepackage[hidelinks]{hyperref}",
        r"\usepackage{parskip}",
        r"\pagenumbering{gobble}",
    ]

    if cfg.font_setup:
        lines.append(cfg.font_setup)

    # Color setup
    if cfg.accent_rgb:
        r, g, b = cfg.accent_rgb
        lines.append(r"\usepackage[dvipsnames,svgnames]{xcolor}")
        lines.append(rf"\definecolor{{accent}}{{RGB}}{{{r},{g},{b}}}")
    elif cfg.section_style == "scshape_rule":
        lines.append(r"\usepackage[dvipsnames,svgnames]{xcolor}")

    if cfg.glyphtounicode:
        lines += [r"\usepackage{glyphtounicode}", r"\pdfgentounicode=1"]

    lines.append(r"\setcounter{secnumdepth}{0}")

    # Section heading styles
    if cfg.section_style == "uppercase_rule":
        lines += [
            r"\titleformat{\section}{\bfseries\normalsize}{}{0em}{\MakeUppercase}"
            r"[\vspace{-4pt}\rule{\linewidth}{0.4pt}]",
            r"\titlespacing*{\section}{0pt}{8pt}{4pt}",
        ]
    elif cfg.section_style == "colored_bar":
        lines += [
            r"\titleformat{\section}{\large\bfseries\color{accent}}{}{0em}{}"
            r"[{\color{accent}\titlerule[1.5pt]}]",
            r"\titlespacing{\section}{0pt}{10pt}{6pt}",
        ]
    elif cfg.section_style == "modern_green":
        # Microsoft-style: ALL CAPS bold section headers with thin accent rule below.
        # Section titles are passed pre-uppercased from the renderers, so no \MakeUppercase needed.
        lines += [
            r"\titleformat{\section}{\bfseries\normalsize\color{accent}}{}{0em}{}"
            r"[\vspace{-4pt}{\color{accent}\rule{\linewidth}{0.6pt}}]",
            r"\titlespacing*{\section}{0pt}{10pt}{5pt}",
        ]
    elif cfg.section_style == "scshape_rule":
        lines += [
            r"\titleformat{\section}{\scshape\raggedright\large}{}{0em}{}[\color{black}\titlerule]",
            r"\titlespacing*{\section}{0pt}{8pt}{4pt}",
        ]
    elif cfg.section_style == "sc_accent_rule":
        # Small-caps section titles in the accent color with a thin accent rule.
        lines += [
            r"\titleformat{\section}{\scshape\large\color{accent}}{}{0em}{}"
            r"[\vspace{-3pt}{\color{accent}\titlerule[0.5pt]}]",
            r"\titlespacing*{\section}{0pt}{9pt}{5pt}",
        ]
    elif cfg.section_style == "swiss_plain":
        # Ruleless: small bold uppercase labels in the accent color, whitespace does the separating.
        lines += [
            r"\titleformat{\section}{\bfseries\small\color{accent}}{}{0em}{\MakeUppercase}",
            r"\titlespacing*{\section}{0pt}{14pt}{5pt}",
        ]

    lines.append(
        rf"\setlist[itemize]{{noitemsep,topsep=2pt,leftmargin=0.2in,label={cfg.bullet_char}}}"
    )

    if cfg.header_style == "left_large":
        lines += [
            r"\newcommand{\nametext}[1]{{\fontsize{28}{34}\selectfont\bfseries #1}}",
            r"\newcommand{\datetext}[1]{#1}",
        ]
    elif cfg.header_style == "centered_sc":
        lines += [
            r"\newcommand{\nametext}[1]{{\fontsize{22}{26}\selectfont\scshape\color{accent}#1}}",
            r"\newcommand{\datetext}[1]{#1}",
        ]
    elif cfg.accent_rgb:
        lines += [
            r"\newcommand{\nametext}[1]{{\fontsize{20}{24}\selectfont\bfseries\color{accent}#1}}",
            r"\newcommand{\datetext}[1]{\textcolor{accent}{#1}}",
        ]
    else:
        lines += [
            r"\newcommand{\nametext}[1]{{\Large\textbf{#1}}}",
            r"\newcommand{\datetext}[1]{#1}",
        ]

    lines.append(r"\begin{document}")
    return "\n".join(lines) + "\n"

LATEX_POSTAMBLE = "\n\\end{document}\n"


# ---------------------------------------------------------------------------
# Main LaTeX document builder
# ---------------------------------------------------------------------------

def build_latex(resume: dict, cfg: TemplateConfig) -> str:
    body_parts = []

    body_parts.append(_render_header(resume, cfg))

    summary_tex = _render_summary(resume)
    if summary_tex:
        body_parts.append(summary_tex)

    section_order = ["experience", "projects", "education", "skills", "certifications", "other"]
    sections_by_type: Dict[str, list] = {}
    for section in resume.get("sections", []):
        stype = section.get("type", "other")
        sections_by_type.setdefault(stype, []).append(section)

    for stype in section_order:
        for section in sections_by_type.get(stype, []):
            if stype == "experience":
                tex = _render_experience(section)
            elif stype == "education":
                tex = _render_education(section)
            elif stype == "projects":
                tex = _render_projects(section)
            elif stype == "skills":
                tex = _render_skills(section)
            elif stype == "certifications":
                tex = _render_certifications(section)
            else:
                tex = _render_generic_section(section)
            if tex:
                body_parts.append(tex)

    result = _build_preamble(cfg)
    for i, part in enumerate(body_parts):
        result += part
        if i < len(body_parts) - 1:
            result += "\n\n"
    result += LATEX_POSTAMBLE
    return result


# ---------------------------------------------------------------------------
# Compile LaTeX → PDF via tectonic
# ---------------------------------------------------------------------------

def compile_latex_to_pdf(latex_source: str) -> bytes:
    tectonic_path = _get_tectonic()

    with tempfile.TemporaryDirectory() as tmpdir:
        tex_path = os.path.join(tmpdir, "resume.tex")
        pdf_path = os.path.join(tmpdir, "resume.pdf")

        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(latex_source)

        result = subprocess.run(
            [tectonic_path, "--outdir", tmpdir, tex_path],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            raise RuntimeError(f"LaTeX compilation failed:\n{result.stderr[-2000:]}")

        if not os.path.exists(pdf_path):
            raise RuntimeError("tectonic ran but no PDF was produced.")

        with open(pdf_path, "rb") as f:
            return f.read()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_pdf_latex(resume_structured: dict, accepted_bullets: Dict[str, str], template_id: str = "jake") -> bytes:
    if template_id not in VALID_TEMPLATES:
        template_id = "jake"
    cfg = _TEMPLATE_REGISTRY[template_id]
    resume = _apply_bullets(resume_structured, accepted_bullets)
    latex_source = build_latex(resume, cfg)
    return compile_latex_to_pdf(latex_source)

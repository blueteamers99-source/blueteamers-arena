import io
import logging
import os
from django.conf import settings
from django.utils import timezone
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode import qr

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Template artwork — clean version with NO placeholder text baked in.
# Dynamic fields are drawn by ReportLab on top of this background.
# ---------------------------------------------------------------------------
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "cert_template.png")
FONTS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")

# ---------------------------------------------------------------------------
# Fonts — Google Fonts (SIL OFL, free for commercial use):
#   Cinzel Bold      → student name (classic award-style engraved caps)
#   Rajdhani Bold    → event title (techy, matches the SOC-arena theme)
#   Montserrat       → labels, date, certificate ID (clean modern labels)
# Each alias falls back to a ReportLab built-in if the TTF is missing.
# ---------------------------------------------------------------------------
_FONT_ALIASES = {
    "Cinzel-Bold":         ("Cinzel-Bold-static.ttf", "Times-Bold"),
    "Rajdhani-Bold":       ("Rajdhani-Bold.ttf", "Helvetica-Bold"),
    "Rajdhani-SemiBold":   ("Rajdhani-SemiBold.ttf", "Helvetica-Bold"),
    "Montserrat-SemiBold": ("Montserrat-SemiBold.ttf", "Helvetica-Bold"),
    "Montserrat-Medium":   ("Montserrat-Medium.ttf", "Helvetica"),
}


def _register_fonts() -> None:
    """Register the bundled TTFs once; ignore failures so certificate
    generation never breaks if a font file is missing."""
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont as ReportLabTTFont

    for alias, (filename, _fallback) in _FONT_ALIASES.items():
        if alias in pdfmetrics.getRegisteredFontNames():
            continue
        path = os.path.normpath(os.path.join(FONTS_DIR, filename))
        try:
            pdfmetrics.registerFont(ReportLabTTFont(alias, path))
        except Exception:
            logger.warning("Certificate font %s could not be loaded from %s", alias, path)


def _font(alias: str) -> str:
    """Return the registered alias, or its built-in fallback."""
    from reportlab.pdfbase import pdfmetrics

    return alias if alias in pdfmetrics.getRegisteredFontNames() else _FONT_ALIASES[alias][1]

# ---------------------------------------------------------------------------
# Overlay positions (fractions of page width/height, origin = bottom-left).
# Derived from pixel analysis of the 1491 × 1055 px template image.
#
# For each field we store:
#   *_cx / *_cy   – where to draw the text (centre-x, baseline-y)
#   *_left / *_right / *_bot / *_top  – optional cover-rect (unused with
#                                       clean template but kept as reference)
# ---------------------------------------------------------------------------
POS = {
    # ── Challenge name (cyan) ────────────────────────────────────────────
    "challenge_cx":  0.445,   # centre-x fraction
    "challenge_cy":  0.788,   # baseline-y fraction (from bottom)

    # ── Student name (green, centred between challenge & description) ───
    #    Challenge baseline ≈ 0.788, description top ≈ 0.55
    #    Midpoint ≈ 0.67
    "student_cx":    0.45,
    "student_cy":    0.70,

    # ── Date of issue (yellow-green, sitting ON the blue underline above
    #    the "DATE OF ISSUE" label). Baseline nudged down so the template's
    #    blue line reads as the underline of the value.
    #    Label center at x ≈ 0.20
    "date_cx":       0.20,
    "date_cy":       0.264,

    # ── Certificate ID (yellow-green, sitting ON its blue underline the
    #    same way). Label center at x ≈ 0.45
    "cert_cx":       0.45,
    "cert_cy":       0.264,

    # ── Bottom-left verification block ──────────────────────────────────
    "id_x":   0.13,  "id_y":   0.115,
    "issued_x": 0.13, "issued_y": 0.083,

    # ── QR code ─────────────────────────────────────────────────────────
    "qr_x": 0.045, "qr_y": 0.055, "qr_size": 60,
}


class CertificatePDFService:
    @staticmethod
    def generate_pdf_bytes(
        name: str,
        college: str,
        event: str,
        score: int,
        rank: int,
        certificate_id: str,
        issued_date: str = "",
    ) -> bytes:
        """
        Generates an A4 Landscape PDF Certificate using the **clean**
        template artwork (cert_template.png) as the background, with
        dynamic participant details drawn on top.

        The template PNG has NO placeholder text — only the design,
        graphics, labels, and decorative elements are present.
        This method draws the actual values at the correct positions.
        """
        # Always use the current date when the certificate is generated
        issued_date = timezone.now().strftime("%d-%b-%Y").upper()

        buffer = io.BytesIO()
        # A4 Landscape: width = 841.89, height = 595.27
        w, h = landscape(A4)
        c = canvas.Canvas(buffer, pagesize=landscape(A4))
        c.setTitle(f"{name}_Blueteamers_Certificate")

        # ── fonts ────────────────────────────────────────────────────────
        _register_fonts()
        name_font = _font("Cinzel-Bold")
        title_font = _font("Rajdhani-Bold")
        label_font = _font("Montserrat-SemiBold")
        body_font = _font("Montserrat-Medium")

        # ── helpers ──────────────────────────────────────────────────────
        def fx(frac):
            return w * frac

        def fy(frac):
            return h * frac

        def fit_font(draw_fn, text, max_width, start_size, min_size):
            """Draw text centred, shrinking the font until it fits max_width."""
            from reportlab.pdfbase.pdfmetrics import stringWidth

            size = start_size
            while size > min_size and stringWidth(text, draw_fn[0], size) > max_width:
                size -= 1
            return size

        # ===================================================================
        # 1. Template background (clean — no placeholder text)
        # ===================================================================
        if os.path.exists(TEMPLATE_PATH):
            c.drawImage(TEMPLATE_PATH, 0, 0, width=w, height=h,
                        mask=None, preserveAspectRatio=False, anchor='c')
        else:
            # Fallback: plain dark background so generation never breaks
            c.setFillColor(colors.HexColor("#0B132B"))
            c.rect(0, 0, w, h, fill=1, stroke=0)

        # ===================================================================
        # 2. Draw EVENT TITLE (cyan, Rajdhani — techy, theme-matched)
        # ===================================================================
        c.setFillColor(colors.HexColor("#05F9FF"))
        title_size = fit_font((title_font, ""), str(event), w * 0.48, 24, 16)
        c.setFont(title_font, title_size)
        c.drawCentredString(fx(POS["challenge_cx"]), fy(POS["challenge_cy"]), str(event))

        # ===================================================================
        # 3. Draw STUDENT NAME (green Cinzel — engraved award-style caps,
        #    the classic certificate look, highly legible on dark themes).
        #    Width-based auto-fit replaces the old length heuristics.
        # ===================================================================
        c.setFillColor(colors.HexColor("#42C34E"))
        name_size = fit_font((name_font, ""), str(name), w * 0.52, 44, 22)
        c.setFont(name_font, name_size)
        c.drawCentredString(fx(POS["student_cx"]), fy(POS["student_cy"]), str(name))

        # ===================================================================
        # 4. Draw DATE OF ISSUE (yellow-green Montserrat, on its blue line)
        # ===================================================================
        c.setFillColor(colors.HexColor("#D9FD16"))
        c.setFont(label_font, 12)
        c.drawCentredString(fx(POS["date_cx"]), fy(POS["date_cy"]), str(issued_date))

        # ===================================================================
        # 5. Draw CERTIFICATE ID (yellow-green Montserrat, on its blue line)
        # ===================================================================
        c.setFillColor(colors.HexColor("#D9FD16"))
        cert_id_size = fit_font((label_font, ""), str(certificate_id), w * 0.28, 9, 6)
        c.setFont(label_font, cert_id_size)
        c.drawCentredString(fx(POS["cert_cx"]), fy(POS["cert_cy"]), str(certificate_id))

        # ===================================================================
        # 6. Verification QR code (bottom-left)
        # ===================================================================
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        verify_url = f"{frontend_url}/verify?id={certificate_id}"
        qr_code = qr.QrCodeWidget(verify_url)
        bounds = qr_code.getBounds()
        qr_w = bounds[2] - bounds[0]
        qr_h = bounds[3] - bounds[1]
        qr_size = POS["qr_size"]
        d = Drawing(qr_size, qr_size,
                    transform=[qr_size / qr_w, 0, 0, qr_size / qr_h, 0, 0])
        d.drawOn(c, fx(POS["qr_x"]), fy(POS["qr_y"]))

        # ===================================================================
        # 7. Verification ID & issued date (bottom-left, small text)
        # ===================================================================
        c.setFillColor(colors.HexColor("#E2E8F0"))
        c.setFont(label_font, 8)
        c.drawString(fx(POS["id_x"]), fy(POS["id_y"]), str(certificate_id))
        c.setFont(body_font, 8)
        c.drawString(fx(POS["issued_x"]), fy(POS["issued_y"]), f"Issued: {issued_date}")

        c.showPage()
        c.save()
        return buffer.getvalue()

import io
import os
from django.conf import settings
from django.utils import timezone
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode import qr

# ---------------------------------------------------------------------------
# Template artwork — clean version with NO placeholder text baked in.
# Dynamic fields are drawn by ReportLab on top of this background.
# ---------------------------------------------------------------------------
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "cert_template.png")

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

    # ── Date of issue (yellow-green, centred above "DATE OF ISSUE" label)
    #    Label center at x ≈ 0.20
    "date_cx":       0.20,
    "date_cy":       0.28,

    # ── Certificate ID (yellow-green, centred above "CERTIFICATE ID" label)
    #    Label center at x ≈ 0.45
    "cert_cx":       0.45,
    "cert_cy":       0.28,

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

        # ── helpers ──────────────────────────────────────────────────────
        def fx(frac):
            return w * frac

        def fy(frac):
            return h * frac

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
        # 2. Draw CHALLENGE NAME (cyan, centred)
        # ===================================================================
        c.setFillColor(colors.HexColor("#05F9FF"))
        # Dynamic font size for long names
        title_len = len(str(event))
        if title_len > 40:
            title_size = 18
        elif title_len > 28:
            title_size = 20
        else:
            title_size = 24
        c.setFont("Helvetica-Bold", title_size)
        c.drawCentredString(fx(POS["challenge_cx"]), fy(POS["challenge_cy"]), str(event))

        # ===================================================================
        # 3. Draw STUDENT NAME (green, above description)
        # ===================================================================
        name_len = len(str(name))
        if name_len > 30:
            name_size = 32
        elif name_len > 20:
            name_size = 38
        else:
            name_size = 44
        c.setFillColor(colors.HexColor("#42C34E"))
        c.setFont("Helvetica-Bold", name_size)
        c.drawCentredString(fx(POS["student_cx"]), fy(POS["student_cy"]), str(name))

        # ===================================================================
        # 4. Draw DATE OF ISSUE (yellow-green, left footer)
        # ===================================================================
        c.setFillColor(colors.HexColor("#D9FD16"))
        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(fx(POS["date_cx"]), fy(POS["date_cy"]), str(issued_date))

        # ===================================================================
        # 5. Draw CERTIFICATE ID (yellow-green, right footer)
        # ===================================================================
        c.setFillColor(colors.HexColor("#D9FD16"))
        c.setFont("Helvetica-Bold", 10)
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
        c.setFont("Helvetica-Bold", 9)
        c.drawString(fx(POS["id_x"]), fy(POS["id_y"]), str(certificate_id))
        c.setFont("Helvetica", 9)
        c.drawString(fx(POS["issued_x"]), fy(POS["issued_y"]), f"Issued: {issued_date}")

        c.showPage()
        c.save()
        return buffer.getvalue()

import io
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics.barcode import qr
import urllib.request


class CertificatePDFService:
    @staticmethod
    def generate_pdf_bytes(
        name: str,
        college: str,
        event: str,
        score: int,
        rank: int,
        certificate_id: str,
        issued_date: str = "August 2026",
    ) -> bytes:
        """
        Generates a 300 DPI A4 Landscape High-Resolution Vector PDF Certificate.
        """
        buffer = io.BytesIO()
        # A4 Landscape: width = 841.89, height = 595.27
        w, h = landscape(A4)
        c = canvas.Canvas(buffer, pagesize=landscape(A4))
        c.setTitle(f"{name}_Blueteamers_Certificate")

        # 1. Background & Outer Navy Gradient Fill
        c.setFillColor(colors.HexColor("#0B132B"))
        c.rect(0, 0, w, h, fill=1, stroke=0)

        # Inner dark card area
        c.setFillColor(colors.HexColor("#1C2541"))
        c.rect(20, 20, w - 40, h - 40, fill=1, stroke=0)

        # 2. Golden & Emerald Double Border
        c.setStrokeColor(colors.HexColor("#10B981"))  # Emerald
        c.setLineWidth(3)
        c.rect(30, 30, w - 60, h - 60, fill=0, stroke=1)

        c.setStrokeColor(colors.HexColor("#F59E0B"))  # Amber / Gold accent
        c.setLineWidth(1)
        c.rect(36, 36, w - 72, h - 72, fill=0, stroke=1)

        # 3. Header Title & Branding
        c.setFillColor(colors.HexColor("#10B981"))
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(w / 2, h - 75, "BLUETEAMERS ARENA — OFFICIAL CERTIFICATION OF ACHIEVEMENT")

        c.setFillColor(colors.HexColor("#94A3B8"))
        c.setFont("Helvetica", 10)
        c.drawCentredString(w / 2, h - 95, "VERIFIED CYBERSECURITY SOC COMPETITION CREDENTIAL")

        # 4. Main Body Text
        c.setFillColor(colors.HexColor("#E2E8F0"))
        c.setFont("Helvetica", 12)
        c.drawCentredString(w / 2, h - 145, "This is to certify that")

        # Student Name (Large Bold Accent)
        c.setFillColor(colors.HexColor("#38BDF8"))  # Cyan / Blue
        c.setFont("Helvetica-Bold", 28)
        c.drawCentredString(w / 2, h - 185, str(name).upper())

        c.setFillColor(colors.HexColor("#CBD5E1"))
        c.setFont("Helvetica", 11)
        c.drawCentredString(
            w / 2,
            h - 220,
            f"representing {college} has successfully completed all incident investigation challenges in",
        )

        c.setFillColor(colors.HexColor("#F59E0B"))
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(w / 2, h - 250, str(event))

        # 5. Score & Rank Badges
        c.setFillColor(colors.HexColor("#0F172A"))
        c.roundRect(w / 2 - 160, h - 315, 320, 45, 8, fill=1, stroke=1)

        c.setFillColor(colors.HexColor("#10B981"))
        c.setFont("Helvetica-Bold", 12)
        c.drawString(w / 2 - 140, h - 295, f"FINAL SCORE: {score} PTS")

        c.setFillColor(colors.HexColor("#F59E0B"))
        c.setFont("Helvetica-Bold", 12)
        c.drawRightString(w / 2 + 140, h - 295, f"EVENT RANK: #{rank}")

        # 6. Verification ID & QR Code
        verify_url = f"http://localhost:8080/verify/{certificate_id}"
        qr_code = qr.QrCodeWidget(verify_url)
        bounds = qr_code.getBounds()
        qr_w = bounds[2] - bounds[0]
        qr_h = bounds[3] - bounds[1]
        d = Drawing(70, 70, transform=[70.0 / qr_w, 0, 0, 70.0 / qr_h, 0, 0])
        d.add(qr_code)
        d.drawOn(c, 60, 55)

        c.setFillColor(colors.HexColor("#94A3B8"))
        c.setFont("Helvetica", 8)
        c.drawString(140, 95, f"VERIFICATION ID: {certificate_id}")
        c.drawString(140, 80, f"ISSUED: {issued_date}")
        c.drawString(140, 65, "SCAN QR CODE TO VERIFY CREDENTIAL")

        # 7. Official Signatures
        c.setStrokeColor(colors.HexColor("#475569"))
        c.setLineWidth(1)
        c.line(w - 240, 95, w - 60, 95)

        c.setFillColor(colors.HexColor("#F8FAFC"))
        c.setFont("Helvetica-Bold", 10)
        c.drawRightString(w - 60, 80, "Blueteamers Security Examination Board")

        c.setFillColor(colors.HexColor("#94A3B8"))
        c.setFont("Helvetica-Oblique", 8)
        c.drawRightString(w - 60, 65, "Digitally Signed & Validated via PostgreSQL")

        c.showPage()
        c.save()
        return buffer.getvalue()

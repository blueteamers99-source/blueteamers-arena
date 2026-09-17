import importlib.util
import os

import django
from django.conf import settings

if not settings.configured:
    settings.configure(
        DEBUG=False,
        FRONTEND_URL="http://localhost:5173",
        USE_TZ=True,
    )
django.setup()

ASSETS = os.path.dirname(os.path.abspath(__file__))

spec = importlib.util.spec_from_file_location(
    "cert_service",
    os.path.join(ASSETS, "..", "services", "certificate_pdf_service.py"),
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

pdf_bytes = mod.CertificatePDFService.generate_pdf_bytes(
    name="Priya",
    college="Sample Institute of Technology",
    event="AI with SOC Workshop",
    score=750,
    rank=1,
    certificate_id="CERT-BLUETEAM-E19817C8",
    issued_date="September 2026",
)

pdf_path = os.path.join(ASSETS, "_tmp_sample.pdf")
with open(pdf_path, "wb") as f:
    f.write(pdf_bytes)

import pymupdf

doc = pymupdf.open(pdf_path)
page = doc[0]
pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2))
preview_path = os.path.join(ASSETS, "_tmp_preview.png")
pix.save(preview_path)
doc.close()

print(f"PDF: {pdf_path} ({os.path.getsize(pdf_path)} bytes)")
print(f"Preview: {preview_path} ({os.path.getsize(preview_path)} bytes)")

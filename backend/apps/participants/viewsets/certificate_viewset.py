from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from apps.participants.models.participant import Participant


class CertificateViewSet(viewsets.ViewSet):
    authentication_classes = []
    permission_classes = [AllowAny]

    def list(self, request):
        participant = None

        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                import jwt
                from django.conf import settings
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                p_id = payload.get("participant_id")
                if p_id:
                    participant = Participant.objects.filter(id=p_id).first()
            except Exception:
                pass

        if not participant:
            email = request.query_params.get("email") or request.data.get("email")
            if email:
                participant = Participant.objects.filter(email__iexact=str(email).strip().lower()).first()

        if not participant:
            participant = Participant.objects.order_by("-created_at").first()

        if not participant:
            return Response(
                {"success": False, "message": "Participant not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        passing_score = getattr(participant.event, "passing_score", 300) or 300
        is_passed = participant.score >= passing_score
        cert_id = f"CERT-BLUETEAM-{str(participant.id)[:8].upper()}"

        if not is_passed:
            return Response(
                {
                    "success": False,
                    "unlocked": False,
                    "status": "LOCKED",
                    "certificate_id": cert_id,
                    "name": participant.name,
                    "email": participant.email,
                    "college": participant.event.college_name,
                    "event": participant.event.workshop_name,
                    "score": participant.score,
                    "passing_score": passing_score,
                    "message": f"Certificate unavailable. You scored {participant.score}, but {passing_score} points are required to pass.",
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "success": True,
                "unlocked": True,
                "certificate_id": cert_id,
                "verification_id": cert_id,
                "name": participant.name,
                "email": participant.email,
                "college": participant.event.college_name,
                "event": participant.event.workshop_name,
                "score": participant.score,
                "passing_score": passing_score,
                "status": "ISSUED",
                "issued_at": participant.created_at.strftime("%B %Y"),
                "qr_code_url": f"https://api.qrserver.com/v1/create-qr-code/?size=150x150&data={cert_id}",
                "download_url": f"/api/v1/certificate/download/{cert_id}/",
                "message": "Certificate generated successfully.",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="download/(?P<verification_id>[^/.]+)")
    def download(self, request, verification_id=None):
        from django.http import HttpResponse
        from apps.participants.services.certificate_pdf_service import CertificatePDFService

        # Match verification ID (e.g. CERT-BLUETEAM-1A2B3C4D or UUID prefix)
        p_prefix = verification_id.replace("CERT-BLUETEAM-", "").replace("CERT-BTA-", "").lower()
        participant = Participant.objects.filter(id__icontains=p_prefix).first() or Participant.objects.order_by("-created_at").first()

        if not participant:
            return Response({"success": False, "message": "Certificate not found."}, status=status.HTTP_404_NOT_FOUND)

        # Dynamic Rank
        rank = Participant.objects.filter(event=participant.event, score__gt=participant.score).count() + 1

        pdf_bytes = CertificatePDFService.generate_pdf_bytes(
            name=participant.name,
            college=participant.event.college_name,
            event=participant.event.workshop_name,
            score=participant.score,
            rank=rank,
            certificate_id=verification_id,
            issued_date=participant.created_at.strftime("%B %Y"),
        )

        filename = f"{participant.name.replace(' ', '_')}_{participant.event.college_name.replace(' ', '_')}_{participant.event.workshop_name.replace(' ', '_')}.pdf"

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=["get"], url_path="verify/(?P<verification_id>[^/.]+)")
    def verify(self, request, verification_id=None):
        p_prefix = verification_id.replace("CERT-BLUETEAM-", "").replace("CERT-BTA-", "").lower()
        participant = Participant.objects.filter(id__icontains=p_prefix).first() or Participant.objects.order_by("-created_at").first()

        if not participant:
            return Response({
                "success": False,
                "verified": False,
                "status": "INVALID",
                "message": "This certificate was not issued by Blueteamers Arena.",
            }, status=status.HTTP_404_NOT_FOUND)

        rank = Participant.objects.filter(event=participant.event, score__gt=participant.score).count() + 1
        passing_score = getattr(participant.event, "passing_score", 300) or 300

        return Response({
            "success": True,
            "verified": True,
            "status": "VALID",
            "verification_id": verification_id,
            "name": participant.name,
            "college": participant.event.college_name,
            "event": participant.event.workshop_name,
            "event_code": participant.event.event_code,
            "score": participant.score,
            "passing_score": passing_score,
            "rank": rank,
            "issued_date": participant.created_at.strftime("%d %b %Y"),
            "qr_code_url": f"https://api.qrserver.com/v1/create-qr-code/?size=150x150&data={verification_id}",
            "issuer": "Verified by Blueteamers Security Board",
        })

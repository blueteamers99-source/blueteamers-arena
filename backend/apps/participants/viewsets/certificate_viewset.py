import logging
import uuid
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from django.conf import settings
from apps.participants.models.participant import Participant
from apps.participants.auth.participant_auth import ParticipantTokenAuthentication
from apps.participants.permissions.is_participant import IsParticipant
logger = logging.getLogger(__name__)


class CertificateViewSet(viewsets.ViewSet):
    authentication_classes = [ParticipantTokenAuthentication]
    permission_classes = [IsParticipant]

    def _resolve_participant(self, request):
        """
        Returns the authenticated participant via DRF auth.
        No email lookup, no manual JWT decode, no fallback.
        """
        return getattr(request, "participant", None)

    def list(self, request):
        participant = self._resolve_participant(request)
        if not participant:
            return Response(
                {"success": False, "message": "Authentication required to view certificate status."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        event = participant.event
        passing_score = getattr(event, "passing_score", 600) or 600
        total_challenges = getattr(event, "total_challenges", 5) or 5
        # Strict server-side verification: Score >= passing_score AND completed >= total_challenges
        is_score_passed = participant.score >= passing_score
        is_challenges_completed = participant.completed >= total_challenges
        is_eligible = is_score_passed and is_challenges_completed
        # Previous template format: compact verification ID (first 8 UUID chars).
        cert_id = f"CERT-BLUETEAM-{str(participant.id)[:8].upper()}"
        if not is_eligible:
            reasons = []
            if not is_challenges_completed:
                reasons.append(f"completed {participant.completed}/{total_challenges} challenges")
            if not is_score_passed:
                reasons.append(f"scored {participant.score}/{passing_score} passing points")
            return Response(
                {
                    "success": False,
                    "unlocked": False,
                    "status": "LOCKED",
                    "certificate_id": cert_id,
                    "name": participant.name,
                    "email": participant.email,
                    "college": event.college_name,
                    "event": event.workshop_name,
                    "score": participant.score,
                    "passing_score": passing_score,
                    "completed_challenges": participant.completed,
                    "total_challenges": total_challenges,
                    "message": f"Certificate unavailable. Required: all challenges completed and {passing_score} points (You have {', and '.join(reasons)}).",
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
                "college": event.college_name,
                "event": event.workshop_name,
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
        # Requires participant authentication (class-level IsParticipant) and
        # ownership: a participant may only download their own certificate.
        from django.http import HttpResponse
        from apps.participants.services.certificate_pdf_service import CertificatePDFService
        auth_participant = getattr(request, "participant", None)
        if not auth_participant:
            return Response({"success": False, "message": "Participant authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        if not verification_id:
            return Response({"success": False, "message": "Verification ID required."}, status=status.HTTP_400_BAD_REQUEST)
        # Resolve the ID: accept both the compact display form (first 8 UUID
        # chars — previous template format) and the full 36-char UUID.
        p_id = verification_id.replace("CERT-BLUETEAM-", "").replace("CERT-BTA-", "").lower().strip()
        if len(p_id) < 8:
            return Response({"success": False, "message": "Invalid certificate verification ID format."}, status=status.HTTP_404_NOT_FOUND)
        is_full_uuid = len(p_id) == 36 and p_id.count("-") == 4
        # Ownership: startswith covers both forms (equality for full UUIDs).
        if not str(auth_participant.id).lower().startswith(p_id):
            return Response({"success": False, "message": "Forbidden. You may only download your own certificate."}, status=status.HTTP_403_FORBIDDEN)
        try:
            if is_full_uuid:
                participant = Participant.objects.get(id__iexact=p_id)
            else:
                participant = Participant.objects.get(id__istartswith=p_id)
        except (Participant.DoesNotExist, Exception):
            return Response({"success": False, "message": "Certificate record not found."}, status=status.HTTP_404_NOT_FOUND)
        # Enforce full eligibility: score AND challenge completion
        event = participant.event
        passing_score = getattr(event, "passing_score", 600) or 600
        total_challenges = getattr(event, "total_challenges", 5) or 5
        if participant.score < passing_score:
            return Response({"success": False, "message": "Certificate was not issued for this participant."}, status=status.HTTP_404_NOT_FOUND)
        if participant.completed < total_challenges:
            return Response({"success": False, "message": "Certificate was not issued — not all challenges completed."}, status=status.HTTP_404_NOT_FOUND)
        # Dynamic Rank calculation
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
        # Requires participant authentication (class-level IsParticipant) and
        # ownership: a participant may only verify their own certificate.
        auth_participant = getattr(request, "participant", None)
        if not auth_participant:
            return Response({
                "success": False,
                "verified": False,
                "status": "UNAUTHORIZED",
                "message": "Participant authentication required to verify a certificate.",
            }, status=status.HTTP_401_UNAUTHORIZED)
        if not verification_id:
            return Response({
                "success": False,
                "verified": False,
                "status": "INVALID",
                "message": "Verification ID is required.",
            }, status=status.HTTP_400_BAD_REQUEST)
        # Resolve the ID: accept both the compact display form (first 8 UUID
        # chars — previous template format) and the full 36-char UUID.
        p_id = verification_id.replace("CERT-BLUETEAM-", "").replace("CERT-BTA-", "").lower().strip()
        if len(p_id) < 8:
            return Response({
                "success": False,
                "verified": False,
                "status": "INVALID",
                "message": "This certificate was not issued by Blueteamers Arena.",
            }, status=status.HTTP_404_NOT_FOUND)
        is_full_uuid = len(p_id) == 36 and p_id.count("-") == 4
        try:
            if is_full_uuid:
                participant = Participant.objects.get(id__iexact=p_id)
            else:
                participant = Participant.objects.get(id__istartswith=p_id)
        except (Participant.DoesNotExist, Exception):
            return Response({
                "success": False,
                "verified": False,
                "status": "INVALID",
                "message": "This certificate was not issued by Blueteamers Arena.",
            }, status=status.HTTP_404_NOT_FOUND)
        # Ownership: participants may only verify their own certificate.
        # startswith covers both forms (equality for full UUIDs).
        if not str(auth_participant.id).lower().startswith(p_id):
            return Response({
                "success": False,
                "verified": False,
                "status": "FORBIDDEN",
                "message": "Forbidden. You may only verify your own certificate.",
            }, status=status.HTTP_403_FORBIDDEN)
        # Enforce full eligibility: score AND challenge completion
        event = participant.event
        passing_score = getattr(event, "passing_score", 600) or 600
        total_challenges = getattr(event, "total_challenges", 5) or 5
        if participant.score < passing_score:
            return Response({
                "success": False,
                "verified": False,
                "status": "INVALID",
                "message": "Participant did not meet certificate eligibility criteria.",
            }, status=status.HTTP_404_NOT_FOUND)
        if participant.completed < total_challenges:
            return Response({
                "success": False,
                "verified": False,
                "status": "INVALID",
                "message": "Participant did not complete all required challenges.",
            }, status=status.HTTP_404_NOT_FOUND)
        rank = Participant.objects.filter(event=participant.event, score__gt=participant.score).count() + 1
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
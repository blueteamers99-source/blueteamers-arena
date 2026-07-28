import csv
import json
import io
from typing import Dict, Any, List, Tuple
from apps.participants.models.participant import Participant
from apps.questions.models.question import Question


class ReportService:
    @staticmethod
    def export_participants_csv(event_id: str = None) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Participant ID", "Name", "Email", "College Name", "Event Code", "Score", "Completed Challenges", "Started At", "Finished At"])

        qs = Participant.objects.all().select_related("event")
        if event_id:
            qs = qs.filter(event_id=event_id)

        for p in qs.order_by("-score", "finished_at"):
            writer.writerow([
                str(p.id),
                p.name,
                p.email,
                p.event.college_name,
                p.event.event_code,
                p.score,
                p.completed,
                p.started_at.isoformat() if p.started_at else "",
                p.finished_at.isoformat() if p.finished_at else "",
            ])

        return output.getvalue()

    @staticmethod
    def export_questions_json() -> List[Dict[str, Any]]:
        questions = Question.objects.all()
        data = []
        for q in questions:
            data.append({
                "category": q.category,
                "difficulty": q.difficulty,
                "kind": q.kind,
                "question_text": q.question_text,
                "evidence_text": q.evidence_text,
                "options_json": q.options_json,
                "correct_answer": q.correct_answer,
                "correct_option_index": q.correct_option_index,
                "explanation": q.explanation,
                "default_points": q.default_points,
                "status": q.status,
            })
        return data

    @staticmethod
    def import_questions_json(questions_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        created_count = 0
        skipped_count = 0
        errors = []

        existing_texts = set(Question.objects.values_list("question_text", flat=True))

        for idx, item in enumerate(questions_data, start=1):
            q_text = item.get("question_text") or item.get("question") or ""
            if not q_text.strip():
                errors.append(f"Row {idx}: Missing question text.")
                continue

            if q_text.strip() in existing_texts:
                skipped_count += 1
                continue

            opts = item.get("options_json") or item.get("options") or []
            if isinstance(opts, str):
                opts = [o.strip() for o in opts.split(",") if o.strip()]

            Question.objects.create(
                category=item.get("category", Question.CategoryChoices.PHISHING),
                difficulty=item.get("difficulty", Question.DifficultyChoices.EASY),
                kind=item.get("kind", Question.QuestionKindChoices.TEXT),
                question_text=q_text.strip(),
                evidence_text=item.get("evidence_text", ""),
                options_json=opts,
                correct_answer=str(item.get("correct_answer", "")),
                correct_option_index=int(item.get("correct_option_index", item.get("correct", 0))),
                explanation=item.get("explanation", ""),
                default_points=int(item.get("default_points", item.get("marks", 10))),
                status=item.get("status", Question.StatusChoices.PUBLISHED),
            )
            existing_texts.add(q_text.strip())
            created_count += 1

        return {
            "imported_count": created_count,
            "skipped_count": skipped_count,
            "errors": errors,
        }

    @staticmethod
    def import_questions_file(file_obj) -> Dict[str, Any]:
        filename = file_obj.name.lower()
        items = []

        if filename.endswith(".json"):
            content = file_obj.read().decode("utf-8")
            raw_data = json.loads(content)
            items = raw_data if isinstance(raw_data, list) else [raw_data]
        elif filename.endswith(".csv"):
            content = file_obj.read().decode("utf-8")
            reader = csv.DictReader(io.StringIO(content))
            for row in reader:
                items.append(row)
        else:
            # Fallback for plain text or unsupported binaries
            content = file_obj.read().decode("utf-8", errors="ignore")
            lines = [l.strip() for l in content.splitlines() if l.strip()]
            for l in lines:
                items.append({"question_text": l, "category": "Phishing", "difficulty": "Easy"})

        return ReportService.import_questions_json(items)

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Dict, Any
from backend.models import Student, LeetCodeAccount

class UrlImportService:
    def __init__(self, db: Session):
        self.db = db

    def extract_username(self, url: str) -> str:
        url = url.strip()
        if not url:
            return ""
        # Handle https://leetcode.com/u/username/ or https://leetcode.com/username/
        url = url.rstrip("/")
        parts = url.split("/")
        if len(parts) > 0:
            if parts[-2] == "u":
                return parts[-1]
            return parts[-1]
        return url

    def import_urls(self, data: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Expects a list of dicts: [{"people_id": "P001", "leetcode_url": "https://..."}]
        """
        results = {
            "total": len(data),
            "success": 0,
            "errors": [],
            "skipped": 0
        }

        for row in data:
            people_id = row.get("people_id", "").strip()
            url = row.get("leetcode_url", "").strip()
            
            if not people_id or not url:
                results["errors"].append({"row": row, "error": "Missing people_id or leetcode_url"})
                continue
                
            username = self.extract_username(url)
            if not username:
                results["errors"].append({"row": row, "error": "Could not extract username"})
                continue
                
            # 1. Update Student people_id based on reg_no mapping or fallback
            student = self.db.query(Student).filter(
                (Student.people_id == people_id) | (Student.reg_no == people_id)
            ).first()
            
            if not student:
                results["errors"].append({"row": row, "error": f"Student not found for id {people_id}"})
                continue
                
            # Set people_id if missing (assuming reg_no was used to find them)
            if not student.people_id:
                student.people_id = people_id
                
            # 2. Check if account already exists
            existing_account = self.db.query(LeetCodeAccount).filter(
                LeetCodeAccount.leetcode_username == username,
                LeetCodeAccount.student_id == student.id
            ).first()
            
            if existing_account:
                results["skipped"] += 1
                continue
                
            # 3. Create new account link
            new_account = LeetCodeAccount(
                student_id=student.id,
                leetcode_username=username,
                profile_url=url,
                normalized_username=username.lower()
            )
            self.db.add(new_account)
            results["success"] += 1
            
        try:
            self.db.commit()
        except IntegrityError as e:
            self.db.rollback()
            results["errors"].append({"error": "Database integrity error during bulk commit", "details": str(e)})
            
        return results

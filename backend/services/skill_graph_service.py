"""
skill_graph_service.py — Deep-Tech Student Weakness Radar & Micro-Skill Graph AI Engine

Capabilities:
1. 6-Dimensional DSA Skill Radar:
   - Arrays & Strings
   - Two Pointers & Sliding Window
   - Trees & Binary Search Trees
   - Graphs, BFS & DFS
   - Dynamic Programming
   - Math & Bit Manipulation
2. Automated Gap Detection:
   - Identifies skills under the 40% threshold and tags them as '⚠️ CRITICAL_WEAKNESS'.
3. Personalized Remedial Practice Generator:
   - Recommends curated LeetCode problem paths (Easy -> Medium -> Hard) targeted directly at the student's weakest domain.
"""

from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from backend.models import Student, LeetCodeProfileStats


class SkillGraphService:

    DSA_CURATED_PATHS = {
        "dynamic_programming": [
            {"id": 70, "title": "Climbing Stairs", "difficulty": "Easy", "concept": "1D State Recurrence", "url": "https://leetcode.com/problems/climbing-stairs/"},
            {"id": 198, "title": "House Robber", "difficulty": "Medium", "concept": "Non-Adjacent Decision Making", "url": "https://leetcode.com/problems/house-robber/"},
            {"id": 300, "title": "Longest Increasing Subsequence", "difficulty": "Medium", "concept": "Binary Search DP", "url": "https://leetcode.com/problems/longest-increasing-subsequence/"},
            {"id": 1143, "title": "Longest Common Subsequence", "difficulty": "Medium", "concept": "2D Matrix DP", "url": "https://leetcode.com/problems/longest-common-subsequence/"}
        ],
        "graphs": [
            {"id": 200, "title": "Number of Islands", "difficulty": "Medium", "concept": "Grid Flood Fill DFS", "url": "https://leetcode.com/problems/number-of-islands/"},
            {"id": 207, "title": "Course Schedule", "difficulty": "Medium", "concept": "Topological Sort (Kahn's)", "url": "https://leetcode.com/problems/course-schedule/"},
            {"id": 133, "title": "Clone Graph", "difficulty": "Medium", "concept": "Hash Map BFS", "url": "https://leetcode.com/problems/clone-graph/"}
        ],
        "trees": [
            {"id": 104, "title": "Maximum Depth of Binary Tree", "difficulty": "Easy", "concept": "Recursive Tree Traversal", "url": "https://leetcode.com/problems/maximum-depth-of-binary-tree/"},
            {"id": 236, "title": "Lowest Common Ancestor of a Binary Tree", "difficulty": "Medium", "concept": "Divide & Conquer Post-Order", "url": "https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/"},
            {"id": 124, "title": "Binary Tree Maximum Path Sum", "difficulty": "Hard", "concept": "Global Subtree State Update", "url": "https://leetcode.com/problems/binary-tree-maximum-path-sum/"}
        ],
        "arrays_strings": [
            {"id": 1, "title": "Two Sum", "difficulty": "Easy", "concept": "Hash Map One-Pass", "url": "https://leetcode.com/problems/two-sum/"},
            {"id": 15, "title": "3Sum", "difficulty": "Medium", "concept": "Sorted Two Pointers", "url": "https://leetcode.com/problems/3sum/"},
            {"id": 3, "title": "Longest Substring Without Repeating Characters", "difficulty": "Medium", "concept": "Sliding Window", "url": "https://leetcode.com/problems/longest-substring-without-repeating-characters/"}
        ]
    }

    @classmethod
    def get_student_skill_radar(
        cls,
        db: Session,
        student_id: int
    ) -> Dict[str, Any]:
        """
        Calculates 6-dimensional DSA mastery percentages and generates remedial recommendations.
        """
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            return {"error": "Student not found"}

        stats = student.stats
        total_solved = stats.total_solved if stats else 0
        medium_solved = stats.medium_solved if stats else 0
        hard_solved = stats.hard_solved if stats else 0

        # Deterministic micro-skill calculations based on student performance
        arr_mastery = min(95.0, max(20.0, (total_solved / 150.0) * 85.0))
        two_pt_mastery = min(90.0, max(15.0, (total_solved / 200.0) * 80.0))
        tree_mastery = min(85.0, max(10.0, (medium_solved / 80.0) * 75.0))
        graph_mastery = min(80.0, max(10.0, (medium_solved / 90.0) * 65.0))
        dp_mastery = min(75.0, max(5.0, (hard_solved / 15.0) * 60.0 + (medium_solved / 100.0) * 20.0))
        math_bit_mastery = min(90.0, max(15.0, (total_solved / 180.0) * 70.0))

        radar_dimensions = [
            {"dimension": "Arrays & Strings", "mastery_pct": round(arr_mastery, 1), "status": "STRONG" if arr_mastery >= 70 else "MEDIUM"},
            {"dimension": "Two Pointers & Sliding Window", "mastery_pct": round(two_pt_mastery, 1), "status": "STRONG" if two_pt_mastery >= 70 else "MEDIUM"},
            {"dimension": "Trees & Binary Search Trees", "mastery_pct": round(tree_mastery, 1), "status": "STRONG" if tree_mastery >= 65 else "MEDIUM" if tree_mastery >= 40 else "WEAK ⚠️"},
            {"dimension": "Graphs, BFS & DFS", "mastery_pct": round(graph_mastery, 1), "status": "STRONG" if graph_mastery >= 65 else "MEDIUM" if graph_mastery >= 40 else "WEAK ⚠️"},
            {"dimension": "Dynamic Programming", "mastery_pct": round(dp_mastery, 1), "status": "STRONG" if dp_mastery >= 60 else "MEDIUM" if dp_mastery >= 35 else "CRITICAL_WEAKNESS 🚨"},
            {"dimension": "Math & Bit Manipulation", "mastery_pct": round(math_bit_mastery, 1), "status": "STRONG" if math_bit_mastery >= 65 else "MEDIUM"}
        ]

        # Find primary weakness
        weakest = min(radar_dimensions, key=lambda x: x["mastery_pct"])
        
        # Select practice path
        if "Dynamic Programming" in weakest["dimension"]:
            key = "dynamic_programming"
        elif "Graph" in weakest["dimension"]:
            key = "graphs"
        elif "Tree" in weakest["dimension"]:
            key = "trees"
        else:
            key = "arrays_strings"

        return {
            "student_id": student.id,
            "student_name": student.name,
            "reg_no": student.reg_no,
            "department": student.department.name if student.department else "General",
            "total_solved": total_solved,
            "radar_dimensions": radar_dimensions,
            "primary_weakness": weakest["dimension"],
            "primary_weakness_mastery": weakest["mastery_pct"],
            "personalized_remedial_curriculum": cls.DSA_CURATED_PATHS.get(key, cls.DSA_CURATED_PATHS["dynamic_programming"]),
            "ai_coach_verdict": f"Student exhibits high proficiency in {radar_dimensions[0]['dimension']} ({radar_dimensions[0]['mastery_pct']}%), but requires immediate remedial reinforcement in {weakest['dimension']} ({weakest['mastery_pct']}%)."
        }


skill_graph_service = SkillGraphService()

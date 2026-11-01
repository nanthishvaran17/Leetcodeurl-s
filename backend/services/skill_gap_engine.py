"""
Institutional Skill Gap & Algorithmic Intervention Engine
Calculates real-time topic solve rates, benchmarks, deficits, and curriculum intervention plans
using verified database records from lc_topic_stats and student profiles.
"""

from typing import Dict, Any, List, Optional
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.models import Student, Department, User, LeetCodeTopicStats
from backend.services.authorization_service import apply_role_based_student_filter, get_hod_authorized_department_ids
from backend.constants import get_academic_year_filter_clause

TOPIC_CURRICULUM_DEFINITIONS = [
    {
        "id": "dp",
        "name": "Dynamic Programming (DP)",
        "topic_slug": "dynamic-programming",
        "slugs": ["dynamic-programming"],
        "threshold": 8,
        "target_pct": 60.0,
        "diagnosis": (
            "Students demonstrate high cognitive friction when identifying recurrence relations, "
            "defining overlapping subproblem state spaces, and transitioning from naive recursive trees "
            "to memoization and bottom-up tabulation."
        ),
        "rootCauses": [
            "Subproblem overlap and state transition formulation (f(n) = f(n-1) + f(n-2) vs knapsack choice tables)",
            "High overhead converting recursion trees into 1D/2D memory-efficient iterative matrices",
            "Edge condition handling for base cases, 0/negative states, and unfeasible sub-branches"
        ],
        "sprintPlan": {
            "duration": "2-Week Intensive Sprint",
            "phase1Title": "Week 1: 1D Array Recurrence & Memoization Drill",
            "phase1Desc": "Focus on recursion tree visualization, caching overlapping calls, and 1D state transition tables (Climbing Stairs, House Robber, Coin Change).",
            "phase2Title": "Week 2: 2D Matrix DP, Subsequences & Interview Patterns",
            "phase2Desc": "Transition to grid traversals, longest common subsequences, and hard string edits with space-optimized 2-row rolling buffers.",
            "mentorDirectives": [
                "Conduct 2 mandatory live problem walkthrough labs per section with whiteboard state tracing",
                "Require all gap students to verify test cases and submit at least 5 benchmark DP problems",
                "Pair students with < 30% solve rate with peer coding leads for guided step-by-step debugging"
            ]
        },
        "problems": [
            {"number": 70, "title": "Climbing Stairs", "slug": "climbing-stairs", "difficulty": "Easy", "pattern": "1D State DP / Fibonacci", "url": "https://leetcode.com/problems/climbing-stairs/"},
            {"number": 198, "title": "House Robber", "slug": "house-robber", "difficulty": "Medium", "pattern": "1D DP / Optimal Substructure Decision", "url": "https://leetcode.com/problems/house-robber/"},
            {"number": 322, "title": "Coin Change", "slug": "coin-change", "difficulty": "Medium", "pattern": "Unbounded Knapsack / Min Choice Tabulation", "url": "https://leetcode.com/problems/coin-change/"},
            {"number": 300, "title": "Longest Increasing Subsequence", "slug": "longest-increasing-subsequence", "difficulty": "Medium", "pattern": "1D DP with Binary Search Patience Sort", "url": "https://leetcode.com/problems/longest-increasing-subsequence/"},
            {"number": 72, "title": "Edit Distance", "slug": "edit-distance", "difficulty": "Hard", "pattern": "2D String Matrix State Transition", "url": "https://leetcode.com/problems/edit-distance/"}
        ]
    },
    {
        "id": "graph",
        "name": "Graph BFS/DFS & Shortest Path",
        "topic_slug": "graph",
        "slugs": ["graph", "breadth-first-search", "depth-first-search", "shortest-path"],
        "threshold": 6,
        "target_pct": 65.0,
        "diagnosis": (
            "Students struggle with abstract graph representations (adjacency lists vs matrices), "
            "cycle detection invariants in directed graphs, and multi-source BFS queue synchronizations."
        ),
        "rootCauses": [
            "Translating grid matrices (2D arrays) into implicit graph vertices and directional neighbors",
            "Cycle detection invariants and topological sorting orders (Kahn's algorithm indegree vs DFS 3-color states)",
            "Shortest path edge relaxation and heap state tracking in Dijkstra algorithms"
        ],
        "sprintPlan": {
            "duration": "2-Week Intensive Sprint",
            "phase1Title": "Week 1: Grid Traversals, Connected Components & Visited Sets",
            "phase1Desc": "Focus on 2D grid flood fill, directional vectors (dx, dy), and visited matrix management (Number of Islands, Clone Graph).",
            "phase2Title": "Week 2: Topological Sorting, DAGs & Dijkstra Shortest Path",
            "phase2Desc": "Drill dependency resolution in course schedules, cycle detection, and weighted shortest path priority queues.",
            "mentorDirectives": [
                "Demonstrate BFS queue stepping vs DFS recursion stack unwinding side-by-side in lab",
                "Verify every student implements graph adjacency lists from scratch without helper libraries",
                "Enforce time-complexity proofs (O(V + E)) for all lab assignment submissions"
            ]
        },
        "problems": [
            {"number": 200, "title": "Number of Islands", "slug": "number-of-islands", "difficulty": "Medium", "pattern": "Grid Traversal / BFS & DFS Visited Island Sinks", "url": "https://leetcode.com/problems/number-of-islands/"},
            {"number": 133, "title": "Clone Graph", "slug": "clone-graph", "difficulty": "Medium", "pattern": "Graph Traversal / Hash Map Visited Node Copy", "url": "https://leetcode.com/problems/clone-graph/"},
            {"number": 785, "title": "Is Graph Bipartite?", "slug": "is-graph-bipartite", "difficulty": "Medium", "pattern": "BFS / 2-Color Graph Partition Invariant", "url": "https://leetcode.com/problems/is-graph-bipartite/"},
            {"number": 207, "title": "Course Schedule", "slug": "course-schedule", "difficulty": "Medium", "pattern": "Topological Sort / Indegree & Cycle Detection", "url": "https://leetcode.com/problems/course-schedule/"},
            {"number": 743, "title": "Network Delay Time", "slug": "network-delay-time", "difficulty": "Medium", "pattern": "Dijkstra Algorithm / Min-Heap Edge Relaxation", "url": "https://leetcode.com/problems/network-delay-time/"}
        ]
    },
    {
        "id": "bs_tp",
        "name": "Binary Search & Two Pointers",
        "topic_slug": "binary-search",
        "slugs": ["binary-search", "two-pointers"],
        "threshold": 10,
        "target_pct": 75.0,
        "diagnosis": (
            "While linear scanning is familiar, students encounter repeated off-by-one errors on "
            "search space boundary updates, monotonic predicates on answer spaces, and multi-pointer symmetry."
        ),
        "rootCauses": [
            "Off-by-one boundary bugs (low <= high vs low < high, mid + 1 vs mid)",
            "Determining monotonic properties for binary search on answer spaces (minimum capacity / rate)",
            "Managing pointer contraction without skipping valid permutation subsets"
        ],
        "sprintPlan": {
            "duration": "2-Week Intensive Sprint",
            "phase1Title": "Week 1: Exact Match, Invariant Boundaries & Sorted Search",
            "phase1Desc": "Drill students on the 3 fundamental binary search boundary templates until error-free (Binary Search, Search in Rotated Sorted Array).",
            "phase2Title": "Week 2: Binary Search on Answer Space & Two Pointer Windows",
            "phase2Desc": "Tackle monotonic feasibility functions (Koko Eating Bananas) and shrinking sliding window boundaries (3Sum, Container With Most Water).",
            "mentorDirectives": [
                "Mandate explicit boundary invariant proofs on student lab worksheets before coding",
                "Have students implement ceiling and floor functions from scratch to eliminate off-by-one bugs",
                "Conduct 1-on-1 spot checks on edge condition test cases (empty array, 1-element, duplicates)"
            ]
        },
        "problems": [
            {"number": 704, "title": "Binary Search", "slug": "binary-search", "difficulty": "Easy", "pattern": "Standard Binary Search Template", "url": "https://leetcode.com/problems/binary-search/"},
            {"number": 167, "title": "Two Sum II - Input Array Is Sorted", "slug": "two-sum-ii-input-array-is-sorted", "difficulty": "Medium", "pattern": "Two Pointers / Opposite Ends", "url": "https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/"},
            {"number": 33, "title": "Search in Rotated Sorted Array", "slug": "search-in-rotated-sorted-array", "difficulty": "Medium", "pattern": "Modified Binary Search / Pivot Detection", "url": "https://leetcode.com/problems/search-in-rotated-sorted-array/"},
            {"number": 15, "title": "3Sum", "slug": "3sum", "difficulty": "Medium", "pattern": "Sorting + Two Pointers with Duplicate Avoidance", "url": "https://leetcode.com/problems/3sum/"},
            {"number": 875, "title": "Koko Eating Bananas", "slug": "koko-eating-bananas", "difficulty": "Medium", "pattern": "Binary Search on Monotonic Answer Range", "url": "https://leetcode.com/problems/koko-eating-bananas/"}
        ]
    },
    {
        "id": "tree",
        "name": "Trees & Hierarchical Structures",
        "topic_slug": "tree",
        "slugs": ["tree", "binary-tree", "binary-search-tree"],
        "threshold": 8,
        "target_pct": 70.0,
        "diagnosis": (
            "Students struggle to formulate recursive divide-and-conquer sub-solutions on tree nodes, "
            "managing path sum states across branches, and understanding BST ordering invariants."
        ),
        "rootCauses": [
            "Confusion between bottom-up post-order return values vs top-down pre-order parameter passing",
            "Level-order traversal queue bookkeeping and null-pointer boundary handling",
            "Validating BST range invariants using (-inf, +inf) bounding limits"
        ],
        "sprintPlan": {
            "duration": "2-Week Intensive Sprint",
            "phase1Title": "Week 1: Tree Recursion, Height & Symmetries",
            "phase1Desc": "Master recursive depth-first traversals, tree inversion, symmetric mirroring, and diameter calculations.",
            "phase2Title": "Week 2: BFS Level Order, BST Properties & Lowest Common Ancestor",
            "phase2Desc": "Focus on queue-based level traversals, BST search/insert invariants, and ancestor backtracking.",
            "mentorDirectives": [
                "Require recursive call stack diagrams for all tree assignment submissions",
                "Ensure students code iterative BFS level order using queue length snapshots",
                "Audit BST validation logic to ensure proper range boundary checking"
            ]
        },
        "problems": [
            {"number": 104, "title": "Maximum Depth of Binary Tree", "slug": "maximum-depth-of-binary-tree", "difficulty": "Easy", "pattern": "Bottom-Up Tree Recursion", "url": "https://leetcode.com/problems/maximum-depth-of-binary-tree/"},
            {"number": 226, "title": "Invert Binary Tree", "slug": "invert-binary-tree", "difficulty": "Easy", "pattern": "Tree Subtree Swapping", "url": "https://leetcode.com/problems/invert-binary-tree/"},
            {"number": 102, "title": "Binary Tree Level Order Traversal", "slug": "binary-tree-level-order-traversal", "difficulty": "Medium", "pattern": "BFS Queue / Level Snapshot", "url": "https://leetcode.com/problems/binary-tree-level-order-traversal/"},
            {"number": 98, "title": "Validate Binary Search Tree", "slug": "validate-binary-search-tree", "difficulty": "Medium", "pattern": "BST Range Invariant Propagation", "url": "https://leetcode.com/problems/validate-binary-search-tree/"},
            {"number": 236, "title": "Lowest Common Ancestor of a Binary Tree", "slug": "lowest-common-ancestor-of-a-binary-tree", "difficulty": "Medium", "pattern": "Post-Order Subtree Match Propagation", "url": "https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/"}
        ]
    },
    {
        "id": "backtracking",
        "name": "Backtracking & Recursion",
        "topic_slug": "backtracking",
        "slugs": ["backtracking", "recursion"],
        "threshold": 5,
        "target_pct": 60.0,
        "diagnosis": (
            "Students frequently forget state restoration (undo step) during search tree exploration, "
            "struggle with duplicate pruning logic in subset generation, and exceed recursion time limits."
        ),
        "rootCauses": [
            "Failing to pop state after recursion returns (mutated accumulator bug)",
            "Improper index advancement causing infinite loops in subset choices",
            "Missing base case return conditions and pruning bounds"
        ],
        "sprintPlan": {
            "duration": "2-Week Intensive Sprint",
            "phase1Title": "Week 1: Subsets, Permutations & State Restoration",
            "phase1Desc": "Drill the standard choice-explore-unchoose backtracking pattern across arrays and strings.",
            "phase2Title": "Week 2: Constraint Satisfaction & Grid Backtracking",
            "phase2Desc": "Transition to combination sum bounding, word search grid backtracking, and N-Queens validation.",
            "mentorDirectives": [
                "Enforce drawing the complete recursion decision tree before writing any backtracking code",
                "Ensure students understand passed-by-reference vs passed-by-value accumulator behavior",
                "Review time complexity analysis for exponential 2^n and n! search spaces"
            ]
        },
        "problems": [
            {"number": 78, "title": "Subsets", "slug": "subsets", "difficulty": "Medium", "pattern": "Choice / Include-Exclude Decision Tree", "url": "https://leetcode.com/problems/subsets/"},
            {"number": 46, "title": "Permutations", "slug": "permutations", "difficulty": "Medium", "pattern": "Visited Array / State Swapping", "url": "https://leetcode.com/problems/permutations/"},
            {"number": 39, "title": "Combination Sum", "slug": "combination-sum", "difficulty": "Medium", "pattern": "Unbounded Choice with Target Pruning", "url": "https://leetcode.com/problems/combination-sum/"},
            {"number": 79, "title": "Word Search", "slug": "word-search", "difficulty": "Medium", "pattern": "2D Grid Backtracking with In-Place Visited Masking", "url": "https://leetcode.com/problems/word-search/"},
            {"number": 51, "title": "N-Queens", "slug": "n-queens", "difficulty": "Hard", "pattern": "Diagonal & Column Conflict Invariants", "url": "https://leetcode.com/problems/n-queens/"}
        ]
    }
]


def calculate_institutional_skill_gaps(
    db: Session,
    current_user: Optional[User] = None,
    dept_id: Optional[int] = None,
    year_level: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Computes verified algorithmic topic skill gaps dynamically from live student records.
    Filters accurately by department and cohort year.
    Returns structured InstitutionalSkillGap records sorted by highest deficit first.
    """
    role_clean = (getattr(current_user, "override_role", None) or current_user.role or "").strip().lower() if current_user else ""
    is_hod = "hod" in role_clean or "head of department" in role_clean or role_clean in ["department hod", "department_hod", "placement coordinator"]
    is_global = role_clean in ["admin", "super admin", "super_admin", "administrator", "principal", "management", "director"]

    auth_ids = get_hod_authorized_department_ids(db, current_user) if (is_hod and not is_global) else None
    if auth_ids:
        if dept_id and dept_id in auth_ids:
            pass
        elif dept_id and dept_id not in auth_ids:
            dept_id = auth_ids[0]

    # Query active students in scope
    q = db.query(Student.id).filter(Student.is_active == True)
    if dept_id:
        q = q.filter(Student.department_id == dept_id)
    elif auth_ids:
        q = q.filter(Student.department_id.in_(auth_ids))

    if year_level and year_level != "ALL":
        yr_clause = get_academic_year_filter_clause(Student, year_level)
        if yr_clause is not None:
            q = q.filter(yr_clause)

    if current_user:
        q = apply_role_based_student_filter(q, current_user, db)

    student_rows = q.all()
    student_ids = [s[0] for s in student_rows]
    total_students = len(student_ids)

    if total_students == 0:
        # Fallback cleanly if no students match scope
        return []

    # Efficient bulk query for topic stats
    topic_rows = db.query(
        LeetCodeTopicStats.student_id,
        LeetCodeTopicStats.topic_slug,
        LeetCodeTopicStats.problems_solved
    ).filter(
        LeetCodeTopicStats.student_id.in_(student_ids),
        LeetCodeTopicStats.problems_solved > 0
    ).all()

    # Map student_id -> topic_slug -> problems_solved
    stud_topic_map = defaultdict(lambda: defaultdict(int))
    for sid, slug, cnt in topic_rows:
        stud_topic_map[sid][slug.lower()] += (cnt or 0)

    results = []
    for defn in TOPIC_CURRICULUM_DEFINITIONS:
        cid = defn["id"]
        cname = defn["name"]
        tslug = defn["topic_slug"]
        slugs = [s.lower() for s in defn["slugs"]]
        thresh = defn["threshold"]
        target_pct = defn["target_pct"]

        proficient_count = 0
        all_solved_counts = []

        for sid in student_ids:
            st_map = stud_topic_map[sid]
            tot_topic_solved = sum(st_map.get(sl, 0) for sl in slugs)
            all_solved_counts.append(tot_topic_solved)
            if tot_topic_solved >= thresh:
                proficient_count += 1

        solve_pct = round((proficient_count / float(max(1, total_students))) * 100.0, 1)
        deficit = round(target_pct - solve_pct, 1)
        gap_count = max(0, total_students - proficient_count)
        avg_solved = round(sum(all_solved_counts) / float(max(1, len(all_solved_counts))), 1)

        # Status & Color mapping
        if deficit >= 20.0:
            status = "Critical Gap"
            color = "rose"
        elif deficit >= 5.0:
            status = "Attention Needed"
            color = "amber"
        else:
            status = "Improving"
            color = "blue"

        deficit_str = f"-{deficit:.1f}%" if deficit > 0 else f"+{abs(deficit):.1f}%"

        # Tailor directives with real numbers
        custom_directives = [
            f"Conduct 2 mandatory live problem walkthrough labs per section with whiteboard state tracing",
            f"Require the {gap_count} students with gap (< {thresh} solved) to submit at least 5 curated benchmark problems",
            f"Pair students with low solve rates (< 30%) with peer coding leads for guided step-by-step debugging"
        ]

        sprint_plan_data = dict(defn["sprintPlan"])
        sprint_plan_data["mentorDirectives"] = custom_directives

        results.append({
            "id": cid,
            "name": cname,
            "topic_slug": tslug,
            "solve": f"{solve_pct:.1f}%",
            "solvePct": solve_pct,
            "target": f"{target_pct:.1f}%",
            "targetPct": target_pct,
            "status": status,
            "color": color,
            "deficit": deficit_str,
            "deficit_val": deficit,
            "total_students": total_students,
            "proficient_students": proficient_count,
            "gap_students": gap_count,
            "avg_solved": avg_solved,
            "diagnosis": defn["diagnosis"],
            "rootCauses": defn["rootCauses"],
            "sprintPlan": sprint_plan_data,
            "problems": defn["problems"]
        })

    # Sort so that highest deficit / critical gap appears first
    results.sort(key=lambda x: x["deficit_val"], reverse=True)
    return results

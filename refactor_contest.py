import re

with open('frontend/src/pages/WeeklyContestPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add totalRows state
if 'const [totalRows, setTotalRows] = useState<number>(0);' not in content:
    content = content.replace(
        'const [matrixRows, setMatrixRows] = useState<any[]>([]);',
        'const [matrixRows, setMatrixRows] = useState<any[]>([]);\n  const [totalRows, setTotalRows] = useState<number>(0);'
    )

# 2. Modify fetchSessionDetails
fetch_session_details_new = """
  const fetchSessionDetails = async (sessionId: number, dept: string = 'ALL', year: string = 'ALL', attendance: string = 'ALL', silent: boolean = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestedSessionId = sessionId;
    const reqId = ++latestReqIdRef.current;

    if (!silent) {
      setLoading(true);
      setMatrixRows([]);
      setSessionMetrics(null);
    }

    try {
      const searchParam = debouncedSearchTerm ? `&search=${encodeURIComponent(debouncedSearchTerm)}` : '';
      const sortParam = sortConfig ? `&sort_by=${sortConfig.key}` : '';
      let matrixUrl = `/contests/sessions/${requestedSessionId}/matrix?dept=${dept}&year=${year}&attendance=${attendance}&paginated=true&page=${currentPage}&limit=${pageSize}${searchParam}${sortParam}`;
      
      const [matRes, errRes, compRes] = await Promise.all([
        api.get(matrixUrl, { signal: controller.signal }),
        api.get(`/contests/sessions/${requestedSessionId}/data-quality`, { signal: controller.signal }),
        api.get(`/contests/sessions/${requestedSessionId}/comparison?dept=${dept}&year=${year}&attendance=${attendance}`, { signal: controller.signal })
      ]);

      const responseSessionId = matRes.data?.sessionId ?? matRes.data?.session_id;
      const responseContestNumber = matRes.data?.contestNumber ?? matRes.data?.contest_number;

      if (reqId !== latestReqIdRef.current) return;
      if (selectedSessionIdRef.current !== requestedSessionId) return;

      setMatrixRows(matRes.data?.items || []);
      setTotalRows(matRes.data?.total || 0);
      setSessionMetrics(matRes.data?.metrics || null);
      setErrorLogs(errRes.data || []);
      setComparison(compRes.data || null);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      if (reqId === latestReqIdRef.current && selectedSessionIdRef.current === sessionId) {
        console.error("Contest matrix fetch failed", err);
      }
    } finally {
      if (reqId === latestReqIdRef.current && selectedSessionIdRef.current === sessionId) {
        setLoading(false);
      }
    }
  };
"""

content = re.sub(
    r'  const fetchSessionDetails = async \(sessionId: number.*?setLoading\(false\);\n      \}\n    \}\n  \};\n',
    fetch_session_details_new,
    content,
    flags=re.DOTALL
)

# 3. Add useEffect to re-fetch when pagination/filters change
use_effect_new = """
  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionDetails(selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter, true);
    }
  }, [currentPage, pageSize, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter, debouncedSearchTerm, sortConfig]);
"""
if 'fetchSessionDetails(selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter, true);' not in content:
    content = content.replace(
        '  // Handle Sort Click',
        use_effect_new + '\n  // Handle Sort Click'
    )

# 4. Remove useMemo for filteredMatrixRows and paginatedMatrixRows
content = re.sub(
    r'  const filteredMatrixRows = useMemo\(\(\) => \{.*?\n  \}, \[indexedMatrixRows, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter, debouncedSearchTerm, sortConfig\]\);\n',
    '  const filteredMatrixRows = matrixRows;\n',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'  const paginatedMatrixRows = useMemo\(\(\) => \{.*?\n  \}, \[filteredMatrixRows, currentPage, pageSize\]\);\n',
    '  const paginatedMatrixRows = matrixRows;\n',
    content,
    flags=re.DOTALL
)

# 5. Fix total pages logic
content = re.sub(
    r'const totalPages = Math\.ceil\(filteredMatrixRows\.length \/ pageSize\);',
    'const totalPages = Math.ceil(totalRows / pageSize);',
    content
)
content = re.sub(
    r'filteredMatrixRows\.length > 0',
    'totalRows > 0',
    content
)
content = re.sub(
    r'\{filteredMatrixRows\.length\} Students found',
    '{totalRows} Students found',
    content
)
content = re.sub(
    r'Math\.min\(currentPage \* pageSize, filteredMatrixRows\.length\)',
    'Math.min(currentPage * pageSize, totalRows)',
    content
)
content = re.sub(
    r'\{filteredMatrixRows\.length\}<\/span> students',
    '{totalRows}</span> students',
    content
)

with open('frontend/src/pages/WeeklyContestPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

// Define structure expected by worker
export interface SearchSortPayload {
  students: any[]; // Expecting an array of normalized entities from the store
  searchQuery?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: {
    departmentId?: string;
    yearLevel?: string;
    sectionName?: string;
  };
}

// Pre-computed search index: studentId -> searchable token string
let searchIndexCache = new Map<string, string>();
let lastStudentsVersion = -1; // To check if we need to rebuild the index

// The message handler for the Worker
self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type === 'SEARCH_AND_SORT') {
    const { students, searchQuery, sortBy, sortOrder, filters } = payload as SearchSortPayload;
    
    // 1. Check if we need to build/rebuild the search index
    // In a real app we'd track version, but here we just rebuild if empty or length changed
    if (searchIndexCache.size !== students.length) {
      searchIndexCache.clear();
      for (const s of students) {
        const tokens = [
          s.name, 
          s.reg_no, 
          s.username, 
          s.department?.name, 
          s.department?.code, 
          s.year_level, 
          s.section?.name
        ].filter(Boolean).join(' ').toLowerCase();
        searchIndexCache.set(String(s.id), tokens);
      }
    }

    let result = [...students];

    // 2. Apply Filters (O(N))
    if (filters) {
      result = result.filter(s => {
        let match = true;
        if (filters.departmentId && String(s.department_id) !== filters.departmentId) match = false;
        if (filters.yearLevel && s.year_level !== filters.yearLevel) match = false;
        if (filters.sectionName && s.section?.name !== filters.sectionName) match = false;
        return match;
      });
    }

    // 3. Apply Search (O(N) with O(1) cache lookup)
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(s => {
        const token = searchIndexCache.get(String(s.id));
        return token && token.includes(q);
      });
    }

    // 4. Apply Sort (O(N log N))
    if (sortBy) {
       result.sort((a, b) => {
         let valA = a[sortBy] ?? (a.stats ? a.stats[sortBy] : 0) ?? 0;
         let valB = b[sortBy] ?? (b.stats ? b.stats[sortBy] : 0) ?? 0;
         
         if (valA === valB) return 0;
         if (sortOrder === 'asc') return valA > valB ? 1 : -1;
         return valA < valB ? 1 : -1;
       });
    }

    // Post back just the sorted/filtered array of IDs to minimize serialization cost
    const sortedIds = result.map(s => String(s.id));

    self.postMessage({
      type: 'SORTED_RESULT',
      sortedIds
    });
  }
};

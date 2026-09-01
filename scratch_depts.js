const fs = require('fs');
const content = fs.readFileSync('frontend/src/data/canonicalRoster.ts', 'utf8');
const matches = content.match(/code:\s*'([^']+)'/g);
const codes = matches ? matches.map(m => m.split("'")[1]) : [];
const counts = {};
codes.forEach(c => counts[c] = (counts[c] || 0) + 1);
console.log(counts);

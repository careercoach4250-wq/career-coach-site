// Fetches SimplifyJobs' open internship + new-grad datasets, filters to roles
// that are active, open to Bachelor's degree candidates, and US-located, and
// writes the result to jobs-data.json. Run daily by
// .github/workflows/update-jobs.yml (Node 20+, no dependencies required).

const INTERN_URL =
  "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json";
const GRAD_URL =
  "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json";
const PER_TYPE_LIMIT = 30;

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
  "VA", "WA", "WV", "WI", "WY", "DC", "PR", "VI", "GU", "AS", "MP",
]);

function isUSLocation(loc) {
  const m = loc.match(/,\s*([A-Z]{2})\s*$/);
  if (m && US_STATE_CODES.has(m[1])) return true;
  return /USA|United States/.test(loc);
}

async function getFiltered(url, type) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const raw = await res.json();

  const filtered = raw.filter(
    (j) =>
      j.active === true &&
      Array.isArray(j.degrees) &&
      j.degrees.includes("Bachelor's") &&
      Array.isArray(j.locations) &&
      j.locations.some(isUSLocation)
  );

  const mapped = filtered.map((j) => ({
    id: j.id,
    type,
    category: j.category,
    company: j.company_name,
    title: j.title,
    location: j.locations.filter(isUSLocation).join("; "),
    url: j.url,
    posted: new Date(j.date_posted * 1000).toISOString(),
    postedTs: j.date_posted,
  }));

  mapped.sort((a, b) => b.postedTs - a.postedTs);
  return mapped.slice(0, PER_TYPE_LIMIT);
}

const [interns, newGrads] = await Promise.all([
  getFiltered(INTERN_URL, "Internship"),
  getFiltered(GRAD_URL, "New Grad"),
]);

const all = [...interns, ...newGrads]
  .sort((a, b) => b.postedTs - a.postedTs)
  .map(({ postedTs, ...rest }) => rest);

const output = {
  updatedAt: new Date().toISOString(),
  source:
    "SimplifyJobs (github.com/SimplifyJobs) — Summer2026-Internships & New-Grad-Positions, community-maintained open datasets",
  jobs: all,
};

const fs = await import("node:fs/promises");
await fs.writeFile(
  new URL("../jobs-data.json", import.meta.url),
  JSON.stringify(output, null, 2) + "\n"
);

console.log(`Wrote ${all.length} jobs (${interns.length} internships, ${newGrads.length} new grad).`);

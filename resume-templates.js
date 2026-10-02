/* Career Coach — Resume Template Library (Career Toolkit → Resume → Templates).
   One template per career area. Each template is plain data below: the
   on-page preview and the Word (.docx) download are both generated from it,
   so they never drift apart. The .docx is built in the browser (a tiny
   uncompressed ZIP writer, no library), single-column and ATS-friendly.
   Sample content is deliberately placeholder text in [brackets]: it models
   strong bullet structure without inventing anyone's accomplishments. */
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // entry: { org, where, role, when, bullets[] }   line: { label, text }
  const TEMPLATES = [
    {
      id: "finance",
      area: "Investment Banking / Finance",
      short: "IB & Finance",
      target: "Investment banking / finance",
      font: "Times New Roman",
      blurb: "The traditional banking format: dense, conservative, education first, with deal and modeling experience front and center.",
      lookFor: [
        "Technical fluency: financial modeling, valuation, and accounting, shown through real work or club pitches",
        "Evidence you can handle long hours and detail: consistent formatting with no typos is itself a signal",
        "GPA and test scores, which banks screen on. List GPA if it helps you",
        "Genuine interest in markets, shown through investment clubs, stock pitches, or a personal portfolio",
      ],
      order: ["Education", "Experience", "Leadership & Activities", "Skills, Certifications & Interests"],
      tips: [
        "Keep it strictly one page, in a serif font at 10–11pt, with dates right-aligned.",
        "Your Interests line gets asked about in interviews. Make it specific and true (\"marathon running\" rather than \"sports\").",
        "Club stock pitches count as experience. Include the company, the thesis, and the outcome.",
      ],
      sections: [
        { heading: "Education", entries: [
          { org: "Tulane University, A. B. Freeman School of Business", where: "New Orleans, LA", role: "Bachelor of Science in Management, Major in Finance", when: "Expected May [Year]",
            bullets: ["GPA: [X.XX]/4.00  |  Honors: [Dean's List, scholarships]", "Relevant coursework: [Corporate Finance], [Financial Accounting], [Investments], [Valuation]"] },
        ] },
        { heading: "Experience", entries: [
          { org: "[Firm Name]", where: "[City, ST]", role: "[Summer Analyst / Finance Intern]", when: "[Mon Year] – [Mon Year]",
            bullets: [
              "Built a [three-statement / DCF] model for a [$XM revenue] [industry] company to support a [valuation / buy-side] analysis",
              "Prepared [#] pages of comparable-company and precedent-transaction analysis for [client pitch materials]",
              "Screened [#] potential [acquisition targets] against [size and margin criteria], narrowing to [#] presented to the deal team",
            ] },
          { org: "[Company or Organization]", where: "[City, ST]", role: "[Role]", when: "[Mon Year] – [Mon Year]",
            bullets: [
              "[Action verb] + [what you did] + [result, with a number where possible]",
              "Reconciled [#] [accounts / reports] monthly, catching [$X] in discrepancies",
            ] },
        ] },
        { heading: "Leadership & Activities", entries: [
          { org: "[Finance or Investment Club]", where: "New Orleans, LA", role: "[Analyst / Sector Head]", when: "[Mon Year] – Present",
            bullets: [
              "Pitched [Company] ([long / short]) to [#] members with a [#]-page thesis and valuation; [outcome, e.g. added to club portfolio]",
              "Led a [#]-person team covering the [sector] sector in a [$X] [student-managed / paper] portfolio",
            ] },
        ] },
        { heading: "Skills, Certifications & Interests", lines: [
          { label: "Technical", text: "Excel (financial modeling, [pivot tables]), PowerPoint, [Bloomberg / Capital IQ / FactSet]" },
          { label: "Certifications", text: "[Bloomberg Market Concepts], [other finance coursework or certifications]" },
          { label: "Languages", text: "[Language (proficiency)]" },
          { label: "Interests", text: "[2–3 specific, genuine interests]" },
        ] },
      ],
    },
    {
      id: "consulting",
      area: "Consulting",
      short: "Consulting",
      target: "Management consulting",
      font: "Times New Roman",
      blurb: "Built to show problem-solving and leadership: every bullet tells a mini case of a problem, your analysis, and the impact.",
      lookFor: [
        "Structured problem-solving: bullets that show you diagnosed a problem and drove a result",
        "Leadership and teamwork, especially roles where you led peers without formal authority",
        "Quantified impact on almost every line, including from clubs and class projects",
        "A \"spike\": one area where you clearly stand out",
      ],
      order: ["Education", "Experience", "Leadership & Activities", "Additional Information"],
      tips: [
        "Write every bullet as problem, action, result. Consultants read resumes the way they read slides: for the \"so what.\"",
        "Student consulting projects count. Name the client type (nonprofit, local business) and the recommendation you made.",
        "Keep an Additional section for languages, skills, and interests. Interviewers often use it as an icebreaker.",
      ],
      sections: [
        { heading: "Education", entries: [
          { org: "Tulane University", where: "New Orleans, LA", role: "Bachelor of [Arts / Science] in [Major]; Minor in [Minor]", when: "Expected May [Year]",
            bullets: ["GPA: [X.XX]/4.00  |  Honors: [Dean's List, scholarships, honors program]", "Relevant coursework: [Statistics], [Microeconomics], [Strategy], [Data Analysis]"] },
        ] },
        { heading: "Experience", entries: [
          { org: "[Company or Organization]", where: "[City, ST]", role: "[Business Analyst Intern / Strategy Intern]", when: "[Mon Year] – [Mon Year]",
            bullets: [
              "Analyzed [#] months of [sales / operations] data to identify [root cause], recommending [change] projected to save [$X / X%]",
              "Interviewed [#] [stakeholders / customers] and synthesized findings into a [#]-slide recommendation adopted by [leadership]",
              "Built an Excel tracker for [process], cutting weekly reporting time from [X] to [Y] hours",
            ] },
        ] },
        { heading: "Leadership & Activities", entries: [
          { org: "[Student Consulting Group]", where: "New Orleans, LA", role: "[Project Lead / Consultant]", when: "[Mon Year] – Present",
            bullets: [
              "Led a [#]-person team advising a [local nonprofit / small business] on [pricing / market entry]; delivered [#] recommendations, [#] implemented",
              "Sized the [market] at [$XM] using [top-down / bottom-up] estimates to inform the client's [expansion decision]",
            ] },
          { org: "[Club or Organization]", where: "New Orleans, LA", role: "[President / Treasurer / Committee Chair]", when: "[Mon Year] – Present",
            bullets: ["Grew membership from [X] to [Y] by [redesigning recruitment / launching a new event series]"] },
        ] },
        { heading: "Additional Information", lines: [
          { label: "Skills", text: "Excel ([modeling, pivot tables]), PowerPoint, [Tableau / survey design / SQL]" },
          { label: "Languages", text: "[Language (proficiency)]" },
          { label: "Interests", text: "[2–3 specific, genuine interests]" },
        ] },
      ],
    },
    {
      id: "vcpe",
      area: "Venture Capital / Private Equity",
      short: "VC & PE",
      target: "Venture capital / private equity",
      font: "Times New Roman",
      blurb: "A banking-style format with an investing section up top, for sourcing, diligence, and investment memos.",
      lookFor: [
        "Investment judgment: memos, theses, and pitches that show how you think about a company",
        "Deal exposure: sourcing, screening, diligence, or modeling (LBOs for private equity)",
        "For VC: startup or operating experience and genuine curiosity about a sector",
        "For PE: the same technical rigor banks look for, since many PE firms hire from banking",
      ],
      order: ["Education", "Investment Experience", "Experience", "Leadership & Activities", "Skills & Interests"],
      tips: [
        "Put investing work (a VC fellowship, a club fund, a written memo) in its own section above general experience.",
        "Name sectors you've actually studied. \"Built a market map of [#] climate-software startups\" beats \"passionate about tech.\"",
        "Startup experience counts, even founding a small project. Show traction numbers if you have them.",
      ],
      sections: [
        { heading: "Education", entries: [
          { org: "Tulane University, A. B. Freeman School of Business", where: "New Orleans, LA", role: "Bachelor of Science in Management, Major in [Finance]", when: "Expected May [Year]",
            bullets: ["GPA: [X.XX]/4.00  |  Relevant coursework: [Corporate Finance], [Entrepreneurship], [Valuation]"] },
        ] },
        { heading: "Investment Experience", entries: [
          { org: "[Venture Fund / Student Fund / Fellowship]", where: "[City, ST]", role: "[Investment Analyst Intern / Fellow]", when: "[Mon Year] – [Mon Year]",
            bullets: [
              "Sourced and screened [#] [seed / Series A] startups in [sector]; wrote [#] investment memos, [#] advanced to partner meetings",
              "Built a market map of [#] companies in [sector] to inform the fund's [investment thesis]",
              "Supported diligence on [#] deals: [customer calls, competitive analysis, financial model review]",
            ] },
          { org: "[Private Equity Firm or Club]", where: "[City, ST]", role: "[Intern / Analyst]", when: "[Mon Year] – [Mon Year]",
            bullets: ["Built an LBO model for a [$XM EBITDA] [industry] business, testing returns across [#] exit scenarios"] },
        ] },
        { heading: "Experience", entries: [
          { org: "[Startup or Company]", where: "[City, ST]", role: "[Role]", when: "[Mon Year] – [Mon Year]",
            bullets: ["[Action verb] + [what you built or ran] + [traction or result, e.g. grew users from X to Y]"] },
        ] },
        { heading: "Leadership & Activities", entries: [
          { org: "[Investment or Entrepreneurship Club]", where: "New Orleans, LA", role: "[Role]", when: "[Mon Year] – Present",
            bullets: ["Pitched [Company] to [#] members; [outcome]"] },
        ] },
        { heading: "Skills & Interests", lines: [
          { label: "Technical", text: "Excel (financial modeling, LBO / DCF), PowerPoint, [PitchBook / Crunchbase / Capital IQ]" },
          { label: "Interests", text: "[Sectors you follow], [2–3 specific, genuine interests]" },
        ] },
      ],
    },
    {
      id: "accounting",
      area: "Accounting",
      short: "Accounting",
      target: "Accounting / audit / tax",
      font: "Times New Roman",
      blurb: "Clean and precise, with your CPA path and technical accounting skills easy to find.",
      lookFor: [
        "Accuracy and attention to detail, starting with an error-free resume",
        "Progress toward CPA eligibility (in most states, 150 credit hours)",
        "Hands-on work: reconciliations, journal entries, audit or tax support",
        "Excel skill and any accounting software you've used",
      ],
      order: ["Education (with CPA path)", "Experience", "Certifications & Skills", "Leadership & Activities"],
      tips: [
        "State your CPA path plainly, for example \"On track for 150 credit hours by [date]\", if it's true.",
        "Name the tools: Excel functions, [QuickBooks], and any audit or tax software you've touched.",
        "Tax-season or bookkeeping jobs at small firms count. Quantify volume (returns prepared, accounts reconciled).",
      ],
      sections: [
        { heading: "Education", entries: [
          { org: "Tulane University, A. B. Freeman School of Business", where: "New Orleans, LA", role: "Bachelor of Science in Management, Major in Accounting", when: "Expected May [Year]",
            bullets: ["GPA: [X.XX]/4.00  |  CPA path: on track for 150 credit hours by [Mon Year]", "Relevant coursework: [Intermediate Accounting I & II], [Auditing], [Federal Taxation], [Cost Accounting]"] },
        ] },
        { heading: "Experience", entries: [
          { org: "[Firm or Company]", where: "[City, ST]", role: "[Audit / Tax / Accounting Intern]", when: "[Mon Year] – [Mon Year]",
            bullets: [
              "Reconciled [#] [bank / vendor] accounts monthly totaling [$X], resolving [#] discrepancies before close",
              "Prepared [workpapers / [#] individual tax returns] for [#] clients during [busy season]",
              "Automated a recurring [report] in Excel with [XLOOKUP / pivot tables], cutting preparation time by [X%]",
            ] },
          { org: "[Organization]", where: "[City, ST]", role: "[Treasurer / Bookkeeper]", when: "[Mon Year] – Present",
            bullets: ["Managed a [$X] annual budget and [#] reimbursements, producing monthly reports for [#] officers"] },
        ] },
        { heading: "Certifications & Skills", lines: [
          { label: "Certifications", text: "[CPA candidate, expected exam date], [other certifications]" },
          { label: "Technical", text: "Excel ([pivot tables, XLOOKUP]), [QuickBooks], [audit or tax software], GAAP" },
          { label: "Languages", text: "[Language (proficiency)]" },
        ] },
        { heading: "Leadership & Activities", entries: [
          { org: "[Accounting or Business Organization]", where: "New Orleans, LA", role: "[Role]", when: "[Mon Year] – Present",
            bullets: ["[Action verb] + [what you did] + [result]"] },
        ] },
      ],
    },
    {
      id: "marketing",
      area: "Marketing",
      short: "Marketing",
      target: "Marketing",
      font: "Calibri",
      blurb: "A modern, clean layout with a Campaigns & Projects section and room for a portfolio link.",
      lookFor: [
        "Results with numbers: growth, engagement, reach, conversion, cost per click",
        "Creativity backed by data: what you tried, what happened, what you learned",
        "Hands-on tools: analytics, design, email, and social platforms",
        "A portfolio or links to real work",
      ],
      order: ["Education", "Experience", "Campaigns & Projects", "Leadership & Activities", "Skills"],
      tips: [
        "Add a portfolio link in the header, even a simple site with 3–4 projects.",
        "Running a club's Instagram or a small business's email list counts. Report the before-and-after numbers.",
        "A clean sans-serif font is fine in marketing, but keep it single-column so it reads well in applicant tracking systems.",
      ],
      sections: [
        { heading: "Education", entries: [
          { org: "Tulane University", where: "New Orleans, LA", role: "Bachelor of [Science / Arts] in [Marketing / Communication]", when: "Expected May [Year]",
            bullets: ["GPA: [X.XX]/4.00  |  Relevant coursework: [Consumer Behavior], [Digital Marketing], [Marketing Research]"] },
        ] },
        { heading: "Experience", entries: [
          { org: "[Company or Agency]", where: "[City, ST]", role: "[Marketing / Social Media Intern]", when: "[Mon Year] – [Mon Year]",
            bullets: [
              "Planned and ran a [$X] paid social campaign reaching [#] people at a [$X] cost per click, [X%] below target",
              "Wrote [#] [email newsletters / blog posts] with a [X%] average open rate, above the team's [X%] benchmark",
              "Built a weekly [Google Analytics] dashboard tracking [#] KPIs for the [marketing team]",
            ] },
        ] },
        { heading: "Campaigns & Projects", entries: [
          { org: "[Project or Campaign Name]", where: "[Link to work]", role: "[Your role]", when: "[Mon Year]",
            bullets: ["Grew [club / brand] Instagram from [X] to [Y] followers in [#] months by [content strategy]; engagement rate up [X%]"] },
        ] },
        { heading: "Leadership & Activities", entries: [
          { org: "[Club or Organization]", where: "New Orleans, LA", role: "[Marketing Chair / Role]", when: "[Mon Year] – Present",
            bullets: ["Promoted [#] events through [channels], lifting average attendance from [X] to [Y]"] },
        ] },
        { heading: "Skills", lines: [
          { label: "Tools", text: "[Google Analytics], [Canva / Adobe Creative Suite], [HubSpot / Mailchimp], [Meta Ads Manager]" },
          { label: "Skills", text: "Copywriting, content strategy, [SEO basics], [social media analytics]" },
          { label: "Languages", text: "[Language (proficiency)]" },
        ] },
      ],
    },
    {
      id: "tech",
      area: "Technology",
      short: "Technology",
      target: "Software engineering / technology",
      font: "Calibri",
      blurb: "Technical skills up top, projects with tech stacks and links, and a clean single-column layout that parses well in applicant tracking systems.",
      lookFor: [
        "Technical skills recruiters can scan for in seconds, grouped by type",
        "Projects that show you can build end to end, with links to the code",
        "Impact in engineering terms: users, speed, reliability, time saved",
        "Collaboration signals: code reviews, hackathons, team projects",
      ],
      order: ["Education", "Technical Skills", "Experience", "Projects", "Leadership & Activities"],
      tips: [
        "Put a GitHub link in the header and make sure your pinned repos have READMEs.",
        "List the tech stack on each project line, since recruiters and applicant tracking systems search for it.",
        "Only list languages you could handle in a technical interview. Depth beats a long list.",
      ],
      sections: [
        { heading: "Education", entries: [
          { org: "Tulane University, School of Science and Engineering", where: "New Orleans, LA", role: "Bachelor of Science in [Computer Science]", when: "Expected May [Year]",
            bullets: ["GPA: [X.XX]/4.00  |  Relevant coursework: [Data Structures], [Algorithms], [Databases], [Software Engineering]"] },
        ] },
        { heading: "Technical Skills", lines: [
          { label: "Languages", text: "[Python, Java, JavaScript, SQL]" },
          { label: "Frameworks", text: "[React, Node.js, Flask]" },
          { label: "Tools", text: "[Git, Docker, AWS, Linux]" },
        ] },
        { heading: "Experience", entries: [
          { org: "[Company]", where: "[City, ST]", role: "[Software Engineering Intern]", when: "[Mon Year] – [Mon Year]",
            bullets: [
              "Built [feature] in [React / Python] used by [#] [users / internal teams], reducing [load time / manual work] by [X%]",
              "Wrote [#] unit tests, raising coverage of [service] from [X%] to [Y%]",
              "Fixed [#] bugs across [#] releases working in [two-week sprints] with code review",
            ] },
        ] },
        { heading: "Projects", entries: [
          { org: "[Project Name]", where: "[github.com/you/project]", role: "[Python, Flask, PostgreSQL]", when: "[Mon Year]",
            bullets: ["Designed and built [what it does] for [who]; [traction or result, e.g. [#] users or [#] stars]"] },
          { org: "[Hackathon Project]", where: "[github.com/you/project]", role: "[Tech stack]", when: "[Mon Year]",
            bullets: ["Built [what] in [#] hours with a team of [#]; [placed / won / demoed to #]"] },
        ] },
        { heading: "Leadership & Activities", entries: [
          { org: "[Coding or Tech Club]", where: "New Orleans, LA", role: "[Role]", when: "[Mon Year] – Present",
            bullets: ["[Action verb] + [what you did] + [result]"] },
        ] },
      ],
    },
  ];

  const HEADER = { name: "[Your Name]", contact: ["[City, ST]", "[email@tulane.edu]", "[(555) 555-5555]", "[linkedin.com/in/yourname]"] };
  function contactFor(t) {
    const c = HEADER.contact.slice();
    if (t.id === "tech") c.push("[github.com/yourname]");
    if (t.id === "marketing") c.push("[yourportfolio.com]");
    return c;
  }

  // ---- Preview -----------------------------------------------------------------------

  function preview(t) {
    const sec = (s) => `
      <div class="rt-sec">
        <div class="rt-sec-title">${esc(s.heading)}</div>
        ${(s.entries || []).map((e) => `
          <div class="rt-entry">
            <div class="rt-row"><b>${esc(e.org)}</b><span>${esc(e.where)}</span></div>
            <div class="rt-row rt-sub"><i>${esc(e.role)}</i><i>${esc(e.when)}</i></div>
            <ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
          </div>`).join("")}
        ${(s.lines || []).map((l) => `<div class="rt-line"><b>${esc(l.label)}:</b> ${esc(l.text)}</div>`).join("")}
      </div>`;
    return `
      <div class="rt-paper ${t.font === "Calibri" ? "rt-sans" : "rt-serif"}" aria-label="${esc(t.area)} resume template preview">
        <div class="rt-name">${esc(HEADER.name)}</div>
        <div class="rt-contact">${contactFor(t).map(esc).join(" &nbsp;|&nbsp; ")}</div>
        ${t.sections.map(sec).join("")}
      </div>`;
  }

  // ---- .docx writer --------------------------------------------------------------------

  const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const TEXT_WIDTH = 10512; // twips: 8.5in page minus 0.6in side margins

  function run(text, o = {}) {
    const props = (o.b ? "<w:b/>" : "") + (o.i ? "<w:i/>" : "") + (o.caps ? "<w:caps/>" : "") + (o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : "");
    return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${x(text)}</w:t></w:r>`;
  }
  const tabRun = (o = {}) => `<w:r>${o.i ? "<w:rPr><w:i/></w:rPr>" : ""}<w:tab/></w:r>`;
  function para(runs, o = {}) {
    let ppr = "";
    if (o.style) ppr += `<w:pStyle w:val="${o.style}"/>`;
    if (o.list) ppr += `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>`;
    if (o.border) ppr += `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="1E2761"/></w:pBdr>`;
    if (o.rightTab) ppr += `<w:tabs><w:tab w:val="right" w:pos="${TEXT_WIDTH}"/></w:tabs>`;
    ppr += `<w:spacing w:before="${o.before || 0}" w:after="${o.after || 0}"/>`;
    if (o.center) ppr += `<w:jc w:val="center"/>`;
    return `<w:p><w:pPr>${ppr}</w:pPr>${runs}</w:p>`;
  }

  function documentXml(t) {
    let body = "";
    body += para(run(HEADER.name, { b: true, sz: 32 }), { center: true, after: 40 });
    body += para(run(contactFor(t).join("  |  "), { sz: 19 }), { center: true, after: 60 });
    for (const s of t.sections) {
      body += para(run(s.heading, { b: true, caps: true }), { border: true, before: 160, after: 60 });
      for (const e of s.entries || []) {
        body += para(run(e.org, { b: true }) + tabRun() + run(e.where), { rightTab: true, before: 60 });
        body += para(run(e.role, { i: true }) + tabRun({ i: true }) + run(e.when, { i: true }), { rightTab: true });
        for (const b of e.bullets) body += para(run(b), { list: true });
      }
      for (const l of s.lines || []) body += para(run(l.label + ": ", { b: true }) + run(l.text), { after: 20 });
    }
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="864" w:bottom="720" w:left="864" w:header="432" w:footer="432" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  }

  function stylesXml(t) {
    const f = x(t.font);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:eastAsia="${f}" w:cs="${f}"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
  }

  const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="220"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

  const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;
  const core = (t) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${x(t.area)} resume template</dc:title><dc:creator>Career Coach</dc:creator></cp:coreProperties>`;

  // Stored (uncompressed) ZIP: tiny and dependency-free.
  const CRC_TABLE = (() => {
    const tbl = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; tbl[n] = c >>> 0; }
    return tbl;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function zip(files) {
    const enc = new TextEncoder();
    const chunks = [], central = [];
    let offset = 0;
    for (const [name, content] of files) {
      const nameB = enc.encode(name), data = enc.encode(content), crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
      local.setUint16(8, 0, true); local.setUint16(10, 0, true); local.setUint16(12, 0x21, true);
      local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
      local.setUint16(26, nameB.length, true); local.setUint16(28, 0, true);
      chunks.push(new Uint8Array(local.buffer), nameB, data);
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, 0, true); cd.setUint16(12, 0, true); cd.setUint16(14, 0x21, true);
      cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
      cd.setUint16(28, nameB.length, true); cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), nameB);
      offset += 30 + nameB.length + data.length;
    }
    const cdSize = central.reduce((n, c) => n + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  function docx(t) {
    return zip([
      ["[Content_Types].xml", CONTENT_TYPES],
      ["_rels/.rels", ROOT_RELS],
      ["docProps/core.xml", core(t)],
      ["word/document.xml", documentXml(t)],
      ["word/styles.xml", stylesXml(t)],
      ["word/numbering.xml", NUMBERING],
      ["word/_rels/document.xml.rels", DOC_RELS],
    ]);
  }

  function download(t) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(docx(t));
    a.download = `career-coach-${t.id}-resume-template.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  // ---- Library UI --------------------------------------------------------------------------

  function init() {
    const picker = document.getElementById("rt-picker");
    const detail = document.getElementById("rt-detail");
    if (!picker) return;

    picker.innerHTML = TEMPLATES.map((t) => `
      <button type="button" class="rt-card" data-id="${t.id}" aria-pressed="false">
        <span class="rt-thumb ${t.font === "Calibri" ? "rt-sans" : "rt-serif"}" aria-hidden="true">
          <i class="n"></i><i class="c"></i>${t.sections.slice(0, 4).map(() => `<i class="h"></i><i></i><i></i><i class="s"></i>`).join("")}
        </span>
        <b>${esc(t.area)}</b>
        <span>${esc(t.order.slice(0, 3).join(" · "))}</span>
      </button>`).join("");

    function show(id, focus) {
      const t = TEMPLATES.find((x) => x.id === id) || TEMPLATES[0];
      picker.querySelectorAll(".rt-card").forEach((b) => {
        const on = b.dataset.id === t.id;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      detail.innerHTML = `
        <div class="rt-preview-wrap">${preview(t)}</div>
        <div class="rt-info">
          <span class="eyebrow">${esc(t.short)} template</span>
          <h3>${esc(t.area)}</h3>
          <p class="muted">${esc(t.blurb)}</p>
          <div class="btn-row">
            <button type="button" class="btn btn-primary" data-rt-download>Download Word (.docx)</button>
            <button type="button" class="btn btn-outline" data-rt-feedback>Get feedback for ${esc(t.short)}</button>
          </div>
          <p class="fine-print rt-fine">Opens in Word, Google Docs (File → Open → Upload), or Pages. Replace every [bracket], delete what doesn't apply, and keep it to one page.</p>
          <h4>What ${esc(t.short)} recruiters look for</h4>
          <ul>${t.lookFor.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
          <h4>Section order</h4>
          <ol class="rt-order">${t.order.map((o) => `<li>${esc(o)}</li>`).join("")}</ol>
          <h4>Tips for this field</h4>
          <ul>${t.tips.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
        </div>`;
      detail.querySelector("[data-rt-download]").addEventListener("click", () => download(t));
      detail.querySelector("[data-rt-feedback]").addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("cc:resume-target", { detail: { target: t.target } }));
      });
      if (focus && window.innerWidth < 900) detail.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    picker.addEventListener("click", (e) => {
      const b = e.target.closest(".rt-card");
      if (b) show(b.dataset.id, true);
    });

    // Start on the template that matches the student's target, if any, and
    // follow profile changes until the student picks a template themselves.
    let picked = false;
    picker.addEventListener("click", () => { picked = true; });
    function guess(p) {
      const hint = `${p.roles || ""} ${p.industry || ""} ${p.major || ""}`;
      return /venture|private equity/i.test(hint) ? "vcpe" : /account|audit|tax/i.test(hint) ? "accounting"
        : /consult/i.test(hint) ? "consulting" : /marketing|media|brand/i.test(hint) ? "marketing"
        : /software|tech|computer|data|engineer/i.test(hint) ? "tech" : "finance";
    }
    show(guess(window.CC ? window.CC.profile.get() : {}), false);
    if (window.CC) window.CC.profile.onChange((p) => { if (!picked) show(guess(p), false); });
  }

  window.CCTemplates = { TEMPLATES, docx };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

// Build a self-contained GitHub Pages site (index.html) from readme.md.
// Usage: node scripts/build-site.mjs
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const md = readFileSync(join(root, 'readme.md'), 'utf8');

const REPO_URL = 'https://github.com/andrewfowl/Awesome_Technical_Accounting';
const SITE_URL = 'https://andrewfowl.github.io/Awesome_Technical_Accounting/';
const FEED_URL = SITE_URL + 'rss.xml';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const xmlEsc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// ---- Parse the markdown ----------------------------------------------------
const lines = md.split('\n');
let title = 'Awesome List';
let tagline = '';
let intro = '';
const sections = [];
let section = null;
let group = null;

const itemRe = /^-\s+\[([^\]]+)\]\(([^)]+)\)\s*(?:-\s*(.*))?$/;

const newGroup = (heading) => {
  group = {heading: heading || null, items: []};
  if (section) section.groups.push(group);
};

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  if (line.startsWith('# ')) {
    title = line.replace(/^#\s+/, '').replace(/\s*\[.*$/, '').trim();
    continue;
  }
  if (line.startsWith('> ')) {
    if (!tagline) tagline = line.replace(/^>\s+/, '').trim();
    continue;
  }
  if (line.startsWith('## ')) {
    const heading = line.replace(/^##\s+/, '').trim();
    if (/^contents$/i.test(heading) || /^contributing$/i.test(heading)) {
      section = null;
      group = null;
      continue;
    }
    section = {heading, id: slug(heading), intro: '', groups: []};
    group = null;
    sections.push(section);
    continue;
  }
  if (line.startsWith('### ')) {
    if (!section) continue;
    newGroup(line.replace(/^###\s+/, '').trim());
    continue;
  }

  const m = line.match(itemRe);
  if (m && section) {
    if (!group) newGroup(null);
    group.items.push({name: m[1].trim(), url: m[2].trim(), desc: (m[3] || '').trim()});
    continue;
  }

  // Plain paragraph
  if (!section && !intro && !line.startsWith('#') && !line.startsWith('-')) {
    intro = line;
  } else if (section && group === null && !line.startsWith('-')) {
    section.intro = section.intro ? section.intro + ' ' + line : line;
  }
}

const totalResources = sections.reduce(
  (sum, s) => sum + s.groups.reduce((a, g) => a + g.items.length, 0),
  0,
);

// ---- Render RSS feed -------------------------------------------------------
// One <item> per resource. The guid is derived from the section/name (not the
// URL) so it stays stable even when a firm rotates a guide to a new edition.
const feedItems = sections
  .flatMap((s) =>
    s.groups.flatMap((g) =>
      g.items.map((it) => {
        const category = g.heading ? `${s.heading} / ${g.heading}` : s.heading;
        const guid = `${SITE_URL}#${slug(s.heading + ' ' + (g.heading || '') + ' ' + it.name)}`;
        const description = it.desc || category;
        return [
          '    <item>',
          `      <title>${xmlEsc(it.name)}</title>`,
          `      <link>${xmlEsc(it.url)}</link>`,
          `      <guid isPermaLink="false">${xmlEsc(guid)}</guid>`,
          `      <category>${xmlEsc(category)}</category>`,
          `      <description>${xmlEsc(description)}</description>`,
          '    </item>',
        ].join('\n');
      }),
    ),
  )
  .join('\n');

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEsc(title)}</title>
    <link>${xmlEsc(SITE_URL)}</link>
    <atom:link href="${xmlEsc(FEED_URL)}" rel="self" type="application/rss+xml"/>
    <description>${xmlEsc(tagline)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>scripts/build-site.mjs</generator>
${feedItems}
  </channel>
</rss>
`;

// ---- Render content --------------------------------------------------------
const nav = sections
  .map((s) => {
    const subs = s.groups
      .filter((g) => g.heading)
      .map((g) => `<a class="nav-sub" href="#${slug(s.heading + ' ' + g.heading)}">${esc(g.heading)}</a>`)
      .join('\n');
    return `<a class="nav-top" href="#${s.id}">${esc(s.heading)}</a>${subs ? '\n' + subs : ''}`;
  })
  .join('\n');

const renderItems = (items) =>
  items
    .map((it) => {
      const text = (it.name + ' ' + it.desc).toLowerCase();
      const desc = it.desc ? ` <span class="desc">${esc(it.desc)}</span>` : '';
      return `        <li class="resource" data-text="${escAttr(text)}"><a href="${escAttr(it.url)}" target="_blank" rel="noopener noreferrer">${esc(it.name)}</a>${desc}</li>`;
    })
    .join('\n');

const content = sections
  .map((s) => {
    const intro = s.intro ? `\n      <p class="section-intro">${esc(s.intro)}</p>` : '';
    const groups = s.groups
      .map((g) => {
        const gid = g.heading ? ` id="${slug(s.heading + ' ' + g.heading)}"` : '';
        const head = g.heading ? `\n        <h3${gid}>${esc(g.heading)}</h3>` : '';
        return `      <div class="group">${head}\n        <ul class="resources">\n${renderItems(g.items)}\n        </ul>\n      </div>`;
      })
      .join('\n');
    const count = s.groups.reduce((a, g) => a + g.items.length, 0);
    return `    <section class="section" id="${s.id}">
      <div class="section-head">
        <h2>${esc(s.heading)}</h2>
        <span class="count">${count}</span>
      </div>${intro}
${groups}
    </section>`;
  })
  .join('\n\n');

// ---- Assemble HTML ---------------------------------------------------------
const STYLE = `
:root{
  --bg:#eef2f7; --surface:#ffffff; --surface-2:#f7f9fc;
  --ink:#0b2545; --muted:#54627b; --border:#dde4ee;
  --link:#1257a6; --accent:#0e7c66; --accent-soft:#e3f1ec;
  --shadow:0 1px 2px rgba(11,37,69,.06),0 8px 24px rgba(11,37,69,.06);
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:#0d1117; --surface:#161b22; --surface-2:#10151c;
    --ink:#e6edf3; --muted:#9aa7b8; --border:#26303d;
    --link:#6cb0ff; --accent:#56d4b0; --accent-soft:#10241f;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35);
  }
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0;background:var(--bg);color:var(--ink);
  font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
}
a{color:var(--link);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}

header.hero{
  background:linear-gradient(160deg,#0b2545 0%,#13315c 60%,#0e7c66 160%);
  color:#fff;padding:56px 0 40px;
}
header.hero .wrap{max-width:1120px}
.badges{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.badges a{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.12);
  color:#fff;border:1px solid rgba(255,255,255,.22);padding:5px 12px;border-radius:999px;font-size:13px;font-weight:600}
.badges a:hover{background:rgba(255,255,255,.2);text-decoration:none}
h1{font-size:clamp(28px,4.4vw,44px);margin:0 0 10px;letter-spacing:-.02em;line-height:1.1}
.tagline{font-size:clamp(16px,2vw,20px);margin:0 0 14px;color:#dce6f5;max-width:760px}
.intro{margin:0 0 26px;color:#c4d2e6;max-width:820px}
.stats{display:flex;gap:28px;flex-wrap:wrap;margin-bottom:26px}
.stat b{display:block;font-size:26px;line-height:1}
.stat span{font-size:13px;color:#bcccE3;text-transform:uppercase;letter-spacing:.06em}
.search-box{position:relative;max-width:560px}
.search-box input{
  width:100%;padding:14px 16px 14px 44px;border-radius:12px;border:1px solid rgba(255,255,255,.25);
  background:rgba(255,255,255,.95);color:#0b2545;font-size:16px;box-shadow:var(--shadow)
}
.search-box input:focus{outline:3px solid rgba(14,124,102,.5);border-color:transparent}
.search-box svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);opacity:.55}

.layout{display:grid;grid-template-columns:248px 1fr;gap:36px;padding:34px 0 60px;align-items:start}
nav.toc{position:sticky;top:18px;max-height:calc(100vh - 36px);overflow:auto;
  background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;box-shadow:var(--shadow)}
nav.toc .toc-title{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:2px 0 12px}
nav.toc a{display:block;padding:6px 10px;border-radius:8px;color:var(--ink);font-size:14px}
nav.toc a:hover{background:var(--surface-2);text-decoration:none}
nav.toc a.nav-sub{padding-left:22px;color:var(--muted);font-size:13px}
nav.toc a.active{background:var(--accent-soft);color:var(--accent);font-weight:600}

main{min-width:0}
.section{background:var(--surface);border:1px solid var(--border);border-radius:16px;
  padding:24px 26px;margin-bottom:24px;box-shadow:var(--shadow);scroll-margin-top:14px}
.section-head{display:flex;align-items:center;gap:12px;border-bottom:2px solid var(--border);padding-bottom:12px;margin-bottom:6px}
.section-head h2{margin:0;font-size:22px;letter-spacing:-.01em}
.count{margin-left:auto;background:var(--accent-soft);color:var(--accent);font-size:12px;font-weight:700;
  padding:3px 10px;border-radius:999px}
.section-intro{color:var(--muted);margin:10px 0 4px}
.group{margin-top:14px;scroll-margin-top:14px}
.group h3{font-size:15px;text-transform:uppercase;letter-spacing:.05em;color:var(--accent);margin:18px 0 8px}
ul.resources{list-style:none;margin:0;padding:0}
li.resource{padding:9px 12px;border-radius:10px;border-left:3px solid transparent;transition:background .12s,border-color .12s}
li.resource:hover{background:var(--surface-2);border-left-color:var(--accent)}
li.resource a{font-weight:600}
li.resource .desc{color:var(--muted)}
li.resource .desc::before{content:"— ";color:var(--border)}

#no-results{display:none;text-align:center;color:var(--muted);padding:40px;background:var(--surface);
  border:1px dashed var(--border);border-radius:16px}
#no-results[hidden]{display:none}
#no-results.show{display:block}

footer{border-top:1px solid var(--border);background:var(--surface);padding:30px 0;color:var(--muted);font-size:14px}
footer .wrap{display:flex;gap:18px;flex-wrap:wrap;align-items:center;justify-content:space-between}
footer a{font-weight:600}

@media (max-width:860px){
  .layout{grid-template-columns:1fr;gap:18px}
  nav.toc{position:static;max-height:none}
}
`;

const SCRIPT = `
(function(){
  var search=document.getElementById('search');
  var counter=document.getElementById('result-count');
  var empty=document.getElementById('no-results');
  var items=[].slice.call(document.querySelectorAll('.resource'));
  var groups=[].slice.call(document.querySelectorAll('.group'));
  var secs=[].slice.call(document.querySelectorAll('.section'));
  var total=items.length;

  function visible(el){return el.querySelectorAll('.resource:not([hidden])').length>0;}
  function apply(){
    var q=search.value.trim().toLowerCase();
    var shown=0;
    for(var i=0;i<items.length;i++){
      var ok=q===''||items[i].getAttribute('data-text').indexOf(q)!==-1;
      items[i].hidden=!ok; if(ok)shown++;
    }
    for(var g=0;g<groups.length;g++){groups[g].hidden=!visible(groups[g]);}
    for(var s=0;s<secs.length;s++){secs[s].hidden=!visible(secs[s]);}
    empty.className=shown===0?'show':'';
    counter.textContent=q===''?(total+' resources'):(shown+' of '+total);
  }
  if(search){search.addEventListener('input',apply);}

  // Highlight active section in the table of contents.
  var navLinks={};
  [].slice.call(document.querySelectorAll('nav.toc a')).forEach(function(a){
    navLinks[a.getAttribute('href').slice(1)]=a;
  });
  if('IntersectionObserver' in window){
    var obs=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        var link=navLinks[e.target.id];
        if(!link)return;
        if(e.isIntersecting){
          for(var k in navLinks){navLinks[k].classList.remove('active');}
          link.classList.add('active');
        }
      });
    },{rootMargin:'-10% 0px -80% 0px'});
    secs.forEach(function(s){obs.observe(s);});
  }
})();
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${escAttr(tagline)}">
<meta property="og:title" content="${escAttr(title)}">
<meta property="og:description" content="${escAttr(tagline)}">
<meta property="og:type" content="website">
<link rel="alternate" type="application/rss+xml" title="${escAttr(title)} — RSS feed" href="rss.xml">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📊</text></svg>">
<style>${STYLE}</style>
</head>
<body>
<header class="hero">
  <div class="wrap">
    <div class="badges">
      <a href="https://awesome.re" target="_blank" rel="noopener noreferrer">★ Awesome</a>
      <a href="${escAttr(REPO_URL)}" target="_blank" rel="noopener noreferrer">⌥ GitHub</a>
      <a href="${escAttr(REPO_URL)}/blob/main/license" target="_blank" rel="noopener noreferrer">CC0 License</a>
      <a href="rss.xml">📡 RSS</a>
    </div>
    <h1>${esc(title)}</h1>
    <p class="tagline">${esc(tagline)}</p>
    ${intro ? `<p class="intro">${esc(intro)}</p>` : ''}
    <div class="stats">
      <div class="stat"><b id="result-count">${totalResources} resources</b><span>Curated &amp; linked</span></div>
      <div class="stat"><b>${sections.length}</b><span>Categories</span></div>
    </div>
    <div class="search-box">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input id="search" type="search" placeholder="Search ${totalResources} resources by name or topic…" aria-label="Search resources" autocomplete="off">
    </div>
  </div>
</header>

<div class="wrap">
  <div class="layout">
    <nav class="toc" aria-label="Table of contents">
      <div class="toc-title">Contents</div>
${nav
  .split('\n')
  .map((l) => '      ' + l)
  .join('\n')}
    </nav>
    <main>
${content}
      <div id="no-results">No resources match your search.</div>
    </main>
  </div>
</div>

<footer>
  <div class="wrap">
    <span>Released under <a href="${escAttr(REPO_URL)}/blob/main/license" target="_blank" rel="noopener noreferrer">CC0 1.0</a> · Contributions welcome via <a href="${escAttr(REPO_URL)}/blob/main/contributing.md" target="_blank" rel="noopener noreferrer">the guidelines</a>.</span>
    <span>Subscribe via <a href="rss.xml">RSS</a> · Generated from <a href="${escAttr(REPO_URL)}/blob/main/readme.md" target="_blank" rel="noopener noreferrer">readme.md</a></span>
  </div>
</footer>
<script>${SCRIPT}</script>
</body>
</html>
`;

writeFileSync(join(root, 'index.html'), html);
writeFileSync(join(root, 'rss.xml'), rss);
console.log(
  `Wrote index.html and rss.xml — ${sections.length} sections, ${totalResources} resources.`,
);

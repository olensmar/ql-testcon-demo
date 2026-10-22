"""Generates docs/diagrams/09-orchestrator.svg: how the quality-loop orchestrator is built."""
MONO = "'SF Mono', Menlo, monospace"

code = [  # (indent, code, tag, kind)  kind: agent | code | None
    (0, "prepareWorktree(pr)", "git", "code"),
    (0, "plan = selectTests(pr, diff)", "Selector", "agent"),
    (0, "for (round = 1; ; round++) {", None, None),
    (1, "runs = executePlan(plan, sha)", "Executor", "agent"),
    (1, "if (allPassed || round > MAX) break", None, None),
    (1, "triage = parallel(triageFailure)", "Triage ×N", "agent"),
    (1, "tagTriage(triage)", "Testkube MCP", "code"),
    (1, "fix = remediate(pr, triage)", "Remediator", "agent"),
    (1, "sha = pushFix(); quarantine()", "git · MCP", "code"),
    (0, "}", None, None),
    (0, "gate = reportGate(pr, sha, summary)", "Gate", "agent"),
    (0, "setStatus(); comment(); writeManifest()", "gh · file", "code"),
]

def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

o = []
# --- loop box
o.append('<rect x="470" y="70" width="660" height="500" rx="16" fill="#1C1440" stroke="#818CF8" stroke-width="2.5"/>')
o.append('<text x="495" y="108" font-size="22" font-weight="700" fill="#FFFFFF">runLoop(pr)</text>')
o.append('<text x="640" y="108" font-size="17" fill="#C4BFE6">loop.ts · plain TypeScript</text>')
o.append('<text x="495" y="134" font-size="16" fill="#A49DD0">control flow, guardrails and side effects live here, not in a model</text>')
STEP = 31
y = 178
line_y = []
for indent, line, tag, kind in code:
    line_y.append(y)
    o.append(f'<text x="{495 + indent * 28}" y="{y}" font-size="16" fill="#E4E1F5" font-family="{MONO}" xml:space="preserve">{esc(line)}</text>')
    if kind == "agent":
        o.append(f'<rect x="950" y="{y - 19}" width="160" height="25" rx="12.5" fill="#2B1F63" stroke="#818CF8" stroke-width="2"/>')
        o.append(f'<text x="1030" y="{y - 1}" text-anchor="middle" font-size="15" font-weight="700" fill="#FFFFFF">{esc(tag)}</text>')
    elif kind == "code":
        o.append(f'<rect x="950" y="{y - 19}" width="160" height="25" rx="12.5" fill="none" stroke="#6E64B0" stroke-width="1.5" stroke-dasharray="5 4"/>')
        o.append(f'<text x="1030" y="{y - 1}" text-anchor="middle" font-size="15" fill="#C4BFE6">{esc(tag)}</text>')
    y += STEP
# round loop bracket: from the for-line to the closing brace
top, bottom = line_y[2] - 14, line_y[9] + 4
o.append(f'<path d="M 484 {top} L 478 {top} L 478 {bottom} L 484 {bottom}" fill="none" stroke="#FFAB40" stroke-width="2"/>')
o.append('<line x1="490" y1="536" x2="1110" y2="536" stroke="#4A3F85" stroke-width="1.5"/>')
o.append('<text x="495" y="557" font-size="15" fill="#FFAB40">↻ the for-loop is the fix loop · MAX = 2 fix rounds</text>')
# legend
o.append('<rect x="905" y="544" width="18" height="14" rx="7" fill="#2B1F63" stroke="#818CF8" stroke-width="1.5"/>')
o.append('<text x="929" y="557" font-size="14" fill="#C4BFE6">agent</text>')
o.append('<rect x="985" y="544" width="18" height="14" rx="7" fill="none" stroke="#6E64B0" stroke-width="1.5" stroke-dasharray="4 3"/>')
o.append('<text x="1009" y="557" font-size="14" fill="#C4BFE6">plain code</text>')

# --- runAgent anatomy
o.append('<line x1="1030" y1="570" x2="1030" y2="606" stroke="#818CF8" stroke-width="2.5" marker-end="url(#arrow)"/>')
o.append('<text x="1045" y="594" font-size="16" fill="#C4BFE6">every agent call</text>')
o.append('<rect x="470" y="610" width="660" height="370" rx="16" fill="#2B1F63" stroke="#818CF8" stroke-width="2.5"/>')
o.append('<text x="495" y="648" font-size="22" font-weight="700" fill="#FFFFFF">runAgent(spec)</text>')
o.append('<text x="665" y="648" font-size="17" fill="#C4BFE6">lib/agent.ts · Agent SDK query()</text>')
o.append('<text x="495" y="674" font-size="16" fill="#C4BFE6">one short-lived Claude Code session per call</text>')
rows = [
    ("PROMPT", "prompts/<agent>.md"),
    ("MODEL", "Opus · Sonnet · Haiku 5.5, effort per agent"),
    ("TOOLS", "built-ins per agent: Read · Grep · Edit · Bash(git, npm test)"),
    ("PERMISSIONS", "allowedTools + dontAsk: anything else is denied"),
    ("TESTKUBE", "hosted MCP · HTTP + API token · unused tools hidden"),
    ("OUTPUT", "JSON schema (zod) → validated, typed object"),
    ("WORKING DIR", "the PR worktree (Triage, Remediator)"),
    ("GUARD", "Testkube MCP not connected at start → retry ×3"),
    ("RETURNS", "output · session id · tokens · cost"),
]
y = 712
for k, v in rows:
    o.append(f'<text x="495" y="{y}" font-size="14" font-weight="700" fill="#FFAB40" letter-spacing="0.5">{k}</text>')
    o.append(f'<text x="625" y="{y}" font-size="17" fill="#FFFFFF">{esc(v)}</text>')
    y += 30

# --- left: triggers + outputs
o.append('<text x="30" y="50" font-size="20" font-weight="700" fill="#FFAB40">TRIGGERS</text>')
o.append('<rect x="30" y="70" width="380" height="90" rx="14" fill="#221848" stroke="#8B80D9" stroke-width="2"/>')
o.append(f'<text x="52" y="108" font-size="19" fill="#FFFFFF" font-family="{MONO}">npm run loop -- --pr 12</text>')
o.append('<text x="52" y="138" font-size="16" fill="#C4BFE6">one PR, on demand</text>')
o.append('<rect x="30" y="180" width="380" height="90" rx="14" fill="#221848" stroke="#8B80D9" stroke-width="2"/>')
o.append(f'<text x="52" y="218" font-size="19" fill="#FFFFFF" font-family="{MONO}">npm run watch</text>')
o.append('<text x="52" y="248" font-size="16" fill="#C4BFE6">polls GitHub every 5 s · runs each new PR</text>')
o.append('<polyline points="410,115 438,115 438,160 466,160" fill="none" stroke="#818CF8" stroke-width="2.5" marker-end="url(#arrow)"/>')
o.append('<polyline points="410,225 438,225 438,160" fill="none" stroke="#818CF8" stroke-width="2.5"/>')

o.append('<text x="30" y="340" font-size="20" font-weight="700" fill="#FFAB40">OUTPUTS</text>')
outs = [
    ("Terminal", ["colour-coded stream of every agent:", "tool calls, verdicts, AI spend"]),
    ("GitHub", ["a comment per step, fix commits,", "quality-gate commit status"]),
    ("runs/pr-<n>.json", ["per session: agent, tools it could see,", "tokens, cost, transcript to resume"]),
]
y = 360
for title, lines in outs:
    o.append(f'<rect x="30" y="{y}" width="380" height="110" rx="14" fill="#221848" stroke="#8B80D9" stroke-width="2"/>')
    font = f' font-family="{MONO}"' if title.startswith("runs") else ""
    o.append(f'<text x="52" y="{y + 36}" font-size="19" font-weight="700" fill="#FFFFFF"{font}>{esc(title)}</text>')
    for i, l in enumerate(lines):
        o.append(f'<text x="52" y="{y + 66 + i * 24}" font-size="16" fill="#C4BFE6">{esc(l)}</text>')
    y += 130
o.append('<polyline points="470,440 440,440 440,415 414,415" fill="none" stroke="#818CF8" stroke-width="2.5" marker-end="url(#arrow)"/>')

# --- right: support modules
o.append('<text x="1180" y="50" font-size="20" font-weight="700" fill="#FFAB40">SUPPORT MODULES · lib/</text>')
mods = [
    ("github.ts", "→ GitHub", ["gh CLI: PR, diff, comments,", "commit status · retries network errors"]),
    ("testkube.ts", "→ Testkube MCP", ["MCP client for code-side calls: tags,", "quarantine, dashboard links, tool list"]),
    ("schemas.ts", "", ["zod contracts between agents:", "TestPlan, TriageReport, GateReport, …"]),
    ("spend.ts", "", ["tokens and estimated cost", "per session and model"]),
    ("ui.ts", "", ["terminal rendering of the SDK", "message stream, per agent"]),
]
y = 70
for name, target, lines in mods:
    o.append(f'<rect x="1180" y="{y}" width="390" height="110" rx="14" fill="#221848" stroke="#8B80D9" stroke-width="2"/>')
    o.append(f'<text x="1202" y="{y + 36}" font-size="19" font-weight="700" fill="#FFFFFF" font-family="{MONO}">{name}</text>')
    if target:
        o.append(f'<text x="1548" y="{y + 36}" text-anchor="end" font-size="16" font-weight="700" fill="#FFAB40">{esc(target)}</text>')
    for i, l in enumerate(lines):
        o.append(f'<text x="1202" y="{y + 66 + i * 24}" font-size="16" fill="#C4BFE6">{esc(l)}</text>')
    y += 125
o.append('<line x1="1130" y1="280" x2="1176" y2="280" stroke="#818CF8" stroke-width="2.5" marker-end="url(#arrow)"/>')
o.append('<text x="1153" y="268" text-anchor="middle" font-size="14" fill="#C4BFE6">uses</text>')
# runAgent externals
o.append('<rect x="1180" y="705" width="390" height="275" rx="14" fill="none" stroke="#FFAB40" stroke-width="2" stroke-dasharray="8 6"/>')
o.append('<text x="1202" y="742" font-size="17" font-weight="700" fill="#FFAB40">EACH AGENT SESSION REACHES</text>')
o.append('<text x="1202" y="780" font-size="19" fill="#FFFFFF">· Claude API (its model)</text>')
o.append('<text x="1202" y="812" font-size="19" fill="#FFFFFF">· Testkube MCP, hosted</text>')
o.append('<text x="1202" y="844" font-size="19" fill="#FFFFFF">· the PR worktree on disk</text>')
o.append('<text x="1202" y="890" font-size="15" fill="#A49DD0">and nothing else: no web tools, no other</text>')
o.append('<text x="1202" y="912" font-size="15" fill="#A49DD0">MCP servers, no claude.ai connectors,</text>')
o.append('<text x="1202" y="934" font-size="15" fill="#A49DD0">no project or user settings</text>')
o.append('<line x1="1130" y1="840" x2="1176" y2="840" stroke="#818CF8" stroke-width="2.5" marker-end="url(#arrow)"/>')

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" role="img" aria-label="How the quality-loop orchestrator is built: runLoop in loop.ts is plain TypeScript that calls five agents in order, with the fix loop as a bounded for-loop, and does all side effects itself. Each agent call goes through runAgent, which starts one Claude Code session with its own prompt, model, tool allow-list, hosted Testkube MCP connection with unused tools hidden, and a JSON-schema output. Triggers, outputs and support modules sit around it." font-family="Nunito, 'Helvetica Neue', Arial, sans-serif">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M0,0 L10,5 L0,10 z" fill="#818CF8"/>
    </marker>
  </defs>
  <text x="470" y="50" font-size="20" font-weight="700" fill="#FFAB40">ORCHESTRATION</text>
  {chr(10).join("  " + l for l in o)}
</svg>
'''
open("/Users/olensmar/Dev/ql-testcon-demo/docs/diagrams/09-orchestrator.svg", "w").write(svg)

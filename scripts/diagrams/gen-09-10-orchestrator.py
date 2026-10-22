"""Generates the two orchestrator slides:
docs/diagrams/09-orchestrator-loop.svg (runLoop) and 10-orchestrator-agent.svg (runAgent)."""
MONO = "'SF Mono', Menlo, monospace"
OUT = "/Users/olensmar/Dev/ql-testcon-demo/docs/diagrams/"
def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
DEFS = '''<defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M0,0 L10,5 L0,10 z" fill="#818CF8"/>
    </marker>
  </defs>'''
def svg(w, h, label, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{esc(label)}" '
            f'font-family="Nunito, \'Helvetica Neue\', Arial, sans-serif">\n  {DEFS}\n'
            + "\n".join("  " + l for l in body) + "\n</svg>\n")
def card(o, x, y, w, h, title, lines, mono_title=False, target=""):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="#221848" stroke="#8B80D9" stroke-width="2"/>')
    font = f' font-family="{MONO}"' if mono_title else ""
    o.append(f'<text x="{x + 22}" y="{y + 38}" font-size="21" font-weight="700" fill="#FFFFFF"{font}>{esc(title)}</text>')
    if target:
        o.append(f'<text x="{x + w - 20}" y="{y + 38}" text-anchor="end" font-size="17" font-weight="700" fill="#FFAB40">{esc(target)}</text>')
    for i, l in enumerate(lines):
        o.append(f'<text x="{x + 22}" y="{y + 70 + i * 26}" font-size="17" fill="#C4BFE6">{esc(l)}</text>')

# ---------------------------------------------------------------------------- slide 9: runLoop
code = [
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
o = []
o.append('<text x="30" y="50" font-size="20" font-weight="700" fill="#FFAB40">TRIGGERS</text>')
o.append('<text x="450" y="50" font-size="20" font-weight="700" fill="#FFAB40">ORCHESTRATION</text>')
o.append('<text x="1220" y="50" font-size="20" font-weight="700" fill="#FFAB40">OUTPUTS</text>')
# triggers
card(o, 30, 70, 370, 100, "npm run loop -- --pr 12", ["one PR, on demand"], mono_title=True)
card(o, 30, 190, 370, 100, "npm run watch", ["polls GitHub every 5 s, runs each new PR"], mono_title=True)
o.append('<polyline points="400,120 425,120 425,180 446,180" fill="none" stroke="#818CF8" stroke-width="2.5" marker-end="url(#arrow)"/>')
o.append('<polyline points="400,240 425,240 425,180" fill="none" stroke="#818CF8" stroke-width="2.5"/>')
# support modules (left, below triggers)
o.append('<text x="30" y="350" font-size="20" font-weight="700" fill="#FFAB40">USES · lib/</text>')
mods = [("github.ts", "→ GitHub", "PR, diff, comments, status (gh CLI)"),
        ("testkube.ts", "→ Testkube", "MCP calls made by code, not agents"),
        ("schemas.ts", "", "zod contracts between agents"),
        ("spend.ts · ui.ts", "", "AI spend · colour-coded terminal")]
y = 370
for name, target, line in mods:
    o.append(f'<rect x="30" y="{y}" width="370" height="84" rx="14" fill="#221848" stroke="#8B80D9" stroke-width="2"/>')
    o.append(f'<text x="52" y="{y + 34}" font-size="19" font-weight="700" fill="#FFFFFF" font-family="{MONO}">{esc(name)}</text>')
    if target: o.append(f'<text x="382" y="{y + 34}" text-anchor="end" font-size="16" font-weight="700" fill="#FFAB40">{esc(target)}</text>')
    o.append(f'<text x="52" y="{y + 63}" font-size="16" fill="#C4BFE6">{esc(line)}</text>')
    y += 98
o.append('<line x1="446" y1="560" x2="404" y2="560" stroke="#818CF8" stroke-width="2.5" marker-end="url(#arrow)"/>')
# runLoop box
o.append('<rect x="450" y="70" width="720" height="690" rx="16" fill="#1C1440" stroke="#818CF8" stroke-width="2.5"/>')
o.append('<text x="478" y="114" font-size="26" font-weight="700" fill="#FFFFFF">runLoop(pr)</text>')
o.append('<text x="648" y="114" font-size="19" fill="#C4BFE6">loop.ts · plain TypeScript</text>')
o.append('<text x="478" y="146" font-size="18" fill="#A49DD0">control flow, guardrails and side effects live here, not in a model</text>')
STEP, y, line_y = 42, 205, []
for indent, line, tag, kind in code:
    line_y.append(y)
    o.append(f'<text x="{480 + indent * 32}" y="{y}" font-size="19" fill="#E4E1F5" font-family="{MONO}" xml:space="preserve">{esc(line)}</text>')
    if kind == "agent":
        o.append(f'<rect x="980" y="{y - 23}" width="170" height="31" rx="15.5" fill="#2B1F63" stroke="#818CF8" stroke-width="2"/>')
        o.append(f'<text x="1065" y="{y - 1}" text-anchor="middle" font-size="17" font-weight="700" fill="#FFFFFF">{esc(tag)}</text>')
    elif kind == "code":
        o.append(f'<rect x="980" y="{y - 23}" width="170" height="31" rx="15.5" fill="none" stroke="#6E64B0" stroke-width="1.5" stroke-dasharray="5 4"/>')
        o.append(f'<text x="1065" y="{y - 1}" text-anchor="middle" font-size="17" fill="#C4BFE6">{esc(tag)}</text>')
    y += STEP
top, bottom = line_y[2] - 17, line_y[9] + 5
o.append(f'<path d="M 470 {top} L 463 {top} L 463 {bottom} L 470 {bottom}" fill="none" stroke="#FFAB40" stroke-width="2.5"/>')
o.append('<line x1="470" y1="705" x2="1150" y2="705" stroke="#4A3F85" stroke-width="1.5"/>')
o.append('<text x="478" y="738" font-size="18" fill="#FFAB40">↻ the for-loop is the fix loop · MAX = 2 fix rounds</text>')
o.append('<rect x="930" y="723" width="20" height="16" rx="8" fill="#2B1F63" stroke="#818CF8" stroke-width="1.5"/>')
o.append('<text x="956" y="737" font-size="16" fill="#C4BFE6">agent</text>')
o.append('<rect x="1020" y="723" width="20" height="16" rx="8" fill="none" stroke="#6E64B0" stroke-width="1.5" stroke-dasharray="4 3"/>')
o.append('<text x="1046" y="737" font-size="16" fill="#C4BFE6">plain code</text>')
# outputs
outs = [("Terminal", ["colour-coded stream of every agent:", "tool calls, verdicts, AI spend"], False),
        ("GitHub", ["a comment per step, fix commits,", "quality-gate commit status"], False),
        ("runs/pr-<n>.json", ["per session: agent, tools it could see,", "tokens, cost, transcript to resume"], True)]
y = 70
for title, lines, mono in outs:
    card(o, 1220, y, 350, 128, title, lines, mono_title=mono)
    y += 148
o.append('<line x1="1170" y1="250" x2="1216" y2="250" stroke="#818CF8" stroke-width="2.5" marker-end="url(#arrow)"/>')
open(OUT + "09-orchestrator-loop.svg", "w").write(svg(1600, 790,
    "How the quality loop runs: runLoop in loop.ts is plain TypeScript that calls the five agents in order, with the fix loop as a bounded for-loop, and performs every side effect itself (git, Testkube tags and quarantine, GitHub status and comments). It is started on demand or by a watcher, and writes to the terminal, GitHub and a run manifest.", o))

# ---------------------------------------------------------------------------- slide 10: runAgent
o = []
o.append('<text x="30" y="50" font-size="20" font-weight="700" fill="#FFAB40">EXAMPLE · agents/triage.ts</text>')
o.append('<text x="660" y="50" font-size="20" font-weight="700" fill="#FFAB40">WHAT runAgent() SETS UP</text>')
ex = [
    ("runAgent({", "#E4E1F5"),
    ('  name: "triage",', "#E4E1F5"),
    ('  model: "claude-opus-5-5",', "#E4E1F5"),
    ('  effort: "medium",', "#E4E1F5"),
    ('  tools: ["Read", "Grep", "Glob"],', "#E4E1F5"),
    ("  allowedTools: [", "#E4E1F5"),
    ('    "Read", "Grep", "Glob",', "#E4E1F5"),
    ("    ...tk(", "#E4E1F5"),
    ('      "get_execution_info",', "#FFC978"),
    ('      "fetch_execution_logs",', "#FFC978"),
    ('      "list_artifacts", "read_artifact",', "#FFC978"),
    ('      "query_executions",', "#FFC978"),
    ('      "run_workflow", "wait_for_executions"),', "#FFC978"),
    ("  ],", "#E4E1F5"),
    ("  schema: TriageReport,   // zod", "#E4E1F5"),
    ("  cwd: worktree,          // PR checkout", "#E4E1F5"),
    ("  maxTurns: 20,", "#E4E1F5"),
    ("  prompt: `Triage this failed …`,", "#E4E1F5"),
    ("})", "#E4E1F5"),
]
o.append(f'<rect x="30" y="70" width="590" height="{36 + len(ex) * 30}" rx="14" fill="#1C1440" stroke="#8B80D9" stroke-width="2"/>')
y = 106
for line, color in ex:
    o.append(f'<text x="54" y="{y}" font-size="17" fill="{color}" font-family="{MONO}" xml:space="preserve">{esc(line)}</text>')
    y += 30
o.append(f'<text x="54" y="{y + 22}" font-size="16" fill="#FFC978">orange: the Testkube MCP tools Triage may use; all others are hidden</text>')
# anatomy table
o.append('<rect x="660" y="70" width="910" height="470" rx="16" fill="#2B1F63" stroke="#818CF8" stroke-width="2.5"/>')
o.append('<text x="688" y="114" font-size="26" font-weight="700" fill="#FFFFFF">runAgent(spec)</text>')
o.append('<text x="880" y="114" font-size="19" fill="#C4BFE6">lib/agent.ts · Agent SDK query()</text>')
o.append('<text x="688" y="144" font-size="18" fill="#C4BFE6">one short-lived Claude Code session per call</text>')
rows = [
    ("PROMPT", "prompts/<agent>.md as the system prompt"),
    ("MODEL", "Opus · Sonnet · Haiku 5.5, effort set per agent"),
    ("TOOLS", "built-ins per agent: Read · Grep · Edit · Bash(git, npm test)"),
    ("PERMISSIONS", "allowedTools + dontAsk: anything else is denied"),
    ("TESTKUBE", "hosted MCP over HTTP + API token · unused tools hidden"),
    ("OUTPUT", "JSON schema from zod → validated, typed object"),
    ("WORKING DIR", "the PR worktree (Triage, Remediator)"),
    ("GUARD", "Testkube MCP not connected at start → retry ×3"),
    ("RETURNS", "output · session id · tokens · cost"),
]
y = 192
for k, v in rows:
    o.append(f'<text x="688" y="{y}" font-size="16" font-weight="700" fill="#FFAB40" letter-spacing="0.5">{k}</text>')
    o.append(f'<text x="840" y="{y}" font-size="20" fill="#FFFFFF">{esc(v)}</text>')
    y += 39
o.append('<line x1="620" y1="300" x2="656" y2="300" stroke="#818CF8" stroke-width="2.5" marker-end="url(#arrow)"/>')
# reaches
o.append('<rect x="660" y="575" width="910" height="200" rx="14" fill="none" stroke="#FFAB40" stroke-width="2" stroke-dasharray="8 6"/>')
o.append('<text x="688" y="613" font-size="18" font-weight="700" fill="#FFAB40">EACH AGENT SESSION REACHES</text>')
o.append('<text x="688" y="653" font-size="21" fill="#FFFFFF">· Claude API (its model)</text>')
o.append('<text x="688" y="689" font-size="21" fill="#FFFFFF">· Testkube MCP, hosted</text>')
o.append('<text x="688" y="725" font-size="21" fill="#FFFFFF">· the PR worktree on disk</text>')
o.append('<text x="1110" y="653" font-size="19" fill="#A49DD0">and nothing else:</text>')
o.append('<text x="1110" y="689" font-size="19" fill="#A49DD0">· no web tools · no other MCP servers</text>')
o.append('<text x="1110" y="725" font-size="19" fill="#A49DD0">· no claude.ai connectors</text>')
o.append('<text x="1110" y="761" font-size="19" fill="#A49DD0">· no project or user settings</text>')
o.append('<line x1="1115" y1="540" x2="1115" y2="571" stroke="#818CF8" stroke-width="2.5" marker-end="url(#arrow)"/>')
open(OUT + "10-orchestrator-agent.svg", "w").write(svg(1600, 800,
    "How each agent is set up: runAgent in lib/agent.ts starts one Claude Code session through the Agent SDK's query(), with its own prompt, model and effort, built-in tools, permission allow-list, the hosted Testkube MCP server with unused tools hidden, and a JSON-schema output. Example: the Triage agent's call. Each session reaches only the Claude API, the hosted Testkube MCP server and the PR worktree.", o))
print("ok")

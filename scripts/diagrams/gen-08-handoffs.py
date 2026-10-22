rows = [
  (("PR opened", "ext"), ("Selector", "agent"), "prompt (text)",
   ["PR title, description, changed files", "full diff"],
   ["⚙ gh pr view · gh pr diff", "check out the PR in a git worktree"]),
  (("Selector", "agent"), ("Executor", "agent"), "TestPlan",
   ["selected[ workflow, reason, config ]", "skipped[ workflow, reason ] · summary"],
   ["⚙ add revision = PR head SHA and", "pr = number to every workflow config"]),
  (("Executor", "agent"), ("Triage ×N", "agent"), "ExecutionReport",
   ["executions[ workflow, executionId,", "  status, duration, note ]"],
   ["⚙ keep the failures; none → go to the Gate", "start one Triage per failure, in parallel"]),
  (("Triage ×N", "agent"), ("Remediator", "agent"), "TriageReport[ ]",
   ["classification · confidence · rootCause", "evidence · suspectFiles · rerunExecutionId"],
   ["⚙ tag each execution triage=<class> in Testkube", "post the triage comment on the PR"]),
  (("Remediator", "agent"), ("Executor ↩", "agent"), "RemediationReport",
   ["action · committed · filesChanged", "quarantine[ ] · summary"],
   ["⚙ git push the fix · label quarantine=true", "↩ same plan at the new SHA (max 2 rounds)"]),
  (("Executor", "agent"), ("Gate", "agent"), "ExecutionReport + loop summary",
   ["plan · runs per round · triage per round", "remediations · outcome"],
   ["⚙ all green or rounds used up → Gate; it", "re-checks Testkube (executions tagged pr=N)"]),
  (("Gate", "agent"), ("GitHub", "ext"), "GateReport",
   ["verdict · confidence · headline · summary"],
   ["⚙ quality-gate commit status · final PR comment", "AI spend report · runs/pr-N.json"]),
]
MONO = "'SF Mono', Menlo, monospace"
def pill(x, w, y, label, kind):
    fill, stroke = ("#2B1F63", "#818CF8") if kind == "agent" else ("#221848", "#8B80D9")
    return (f'<rect x="{x}" y="{y}" width="{w}" height="50" rx="25" fill="{fill}" stroke="{stroke}" stroke-width="2.5"/>'
            f'<text x="{x + w/2}" y="{y + 32}" text-anchor="middle" font-size="17" font-weight="700" fill="#FFFFFF">{label}</text>')
out = []
for i, (frm, to, title, fields, code) in enumerate(rows):
    y0 = 95 + 100 * i
    out.append(f'  <!-- row {i}: {frm[0]} -> {to[0]} -->')
    out.append("  " + pill(40, 170, y0 + 21, *frm))
    out.append(f'  <line x1="214" y1="{y0 + 46}" x2="272" y2="{y0 + 46}" stroke="#818CF8" stroke-width="2.5" marker-end="url(#arrow)"/>')
    out.append("  " + pill(276, 230, y0 + 21, *to))
    out.append(f'  <rect x="530" y="{y0}" width="540" height="92" rx="12" fill="#221848" stroke="#4A3F85" stroke-width="2"/>')
    out.append(f'  <text x="550" y="{y0 + 32}" font-size="18" font-weight="700" fill="#FFAB40" font-family="{MONO}">{title}</text>')
    for j, f in enumerate(fields):
        out.append(f'  <text x="550" y="{y0 + 58 + 22*j}" font-size="15.5" fill="#C4BFE6" font-family="{MONO}" xml:space="preserve">{f}</text>')
    out.append(f'  <rect x="1090" y="{y0}" width="470" height="92" rx="12" fill="#1C1440" stroke="#6E64B0" stroke-width="2" stroke-dasharray="7 5"/>')
    for j, c in enumerate(code):
        out.append(f'  <text x="1110" y="{y0 + 38 + 28*j}" font-size="17" fill="#E4E1F5">{c.replace("<", "&lt;").replace(">", "&gt;")}</text>')
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 880" role="img" aria-label="How the agents hand off: the orchestrator code calls each agent in turn and passes its schema-validated JSON result to the next one; between agents, plain code fetches the PR, filters failures, tags Testkube, pushes the fix, applies quarantine labels and reports to GitHub." font-family="Nunito, 'Helvetica Neue', Arial, sans-serif">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M0,0 L10,5 L0,10 z" fill="#818CF8"/>
    </marker>
  </defs>
  <g font-size="17" font-weight="700" fill="#FFAB40">
    <text x="40" y="70">HAND-OFF</text>
    <text x="530" y="70">CONTRACT · JSON, schema-validated</text>
    <text x="1090" y="70">ORCHESTRATOR CODE · no LLM</text>
  </g>
{chr(10).join(out)}
  <rect x="40" y="812" width="1520" height="48" rx="10" fill="#1C1440"/>
  <text x="800" y="843" text-anchor="middle" font-size="18" fill="#E4E1F5">loop.ts calls each agent as a function: one query() with its own prompt, model, tool allow-list and output schema. Agents never call each other.</text>
</svg>
'''
open("/Users/olensmar/Dev/ql-testcon-demo/docs/diagrams/08-handoffs.svg", "w").write(svg)

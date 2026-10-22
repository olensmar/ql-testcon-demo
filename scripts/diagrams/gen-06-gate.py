MONO = "'SF Mono', Menlo, monospace"
rows1 = [("shop-unit-9", "passed", ""), ("shop-api-checkout-9", "failed", "product-bug"), ("shop-e2e-checkout-10", "failed", "product-bug"),
         ("shop-e2e-browse-9", "failed", "flake"), ("shop-e2e-browse-10", "passed", "(re-run)"), ("shop-load-checkout-9", "passed", "")]
rows2 = [("shop-unit-10", "passed"), ("shop-api-checkout-10", "passed"), ("shop-e2e-checkout-11", "passed"), ("shop-load-checkout-10", "passed")]
STATUS = {"passed": "#4ADE80", "failed": "#F87171"}
TRIAGE = {"product-bug": "#FCA5A5", "flake": "#FFC978", "(re-run)": "#A49DD0"}
o = []
y = 227
for name, st, tr in rows1:
    o.append(f'  <text x="62" y="{y}" font-size="17" font-family="{MONO}" fill="#FFFFFF">{name}</text><text x="330" y="{y}" font-size="17" font-family="{MONO}" fill="#FFFFFF">ddee54c</text>')
    o.append(f'  <text x="450" y="{y}" font-size="17" font-weight="700" fill="{STATUS[st]}">{st}</text>')
    if tr: o.append(f'  <text x="570" y="{y}" font-size="16" font-weight="600" fill="{TRIAGE[tr]}">{tr}</text>')
    y += 35
band_y = y - 10
o.append(f'  <rect x="60" y="{band_y}" width="620" height="34" rx="8" fill="#2B1F63"/>')
o.append(f'  <text x="74" y="{band_y + 23}" font-size="16" font-weight="700" fill="#C7CBFF">fix pushed: bbc6211 · round 2 re-run (browse quarantined)</text>')
y = band_y + 70
for name, st in rows2:
    o.append(f'  <text x="62" y="{y}" font-size="17" font-family="{MONO}" fill="#FFFFFF">{name}</text><text x="330" y="{y}" font-size="17" font-family="{MONO}" fill="#FFFFFF">bbc6211</text>')
    o.append(f'  <text x="450" y="{y}" font-size="17" font-weight="700" fill="{STATUS[st]}">{st}</text>')
    y += 35
foot_y = y + 10
table = "\n".join(o)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 860" role="img" aria-label="The Gate agent takes two inputs: from Testkube, every execution tagged with the PR, with its revision, status and triage tag; from the orchestrator, the loop summary with the plan, runs per round, triage reports, remediations and outcome. It applies the gate rules and writes to GitHub: the quality-gate commit status with a confidence score, and the final PR comment." font-family="Nunito, 'Helvetica Neue', Arial, sans-serif">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M0,0 L10,5 L0,10 z" fill="#818CF8"/>
    </marker>
  </defs>

  <text x="40" y="60" font-size="20" font-weight="700" fill="#FFAB40">INPUTS</text>

  <!-- from Testkube -->
  <rect x="40" y="80" width="660" height="{foot_y + 30 - 80}" rx="14" fill="#221848" stroke="#8B80D9" stroke-width="2"/>
  <text x="62" y="118" font-size="22" font-weight="700" fill="#FFFFFF">From Testkube (MCP)</text>
  <text x="62" y="146" font-size="15" fill="#A49DD0" font-family="{MONO}">query_executions  tagSelector=pr=5</text>
  <g font-size="16" font-weight="700" fill="#A49DD0">
    <text x="62" y="182">EXECUTION</text><text x="330" y="182">REVISION</text><text x="450" y="182">STATUS</text><text x="570" y="182">TRIAGE</text>
  </g>
  <line x1="60" y1="194" x2="680" y2="194" stroke="#4A3F85" stroke-width="1.5"/>
{table}
  <text x="62" y="{foot_y}" font-size="15" fill="#A49DD0">Tags come from the workflows (pr, revision) and from triage · demo PR #5</text>

  <!-- from the orchestrator -->
  <rect x="40" y="{foot_y + 55}" width="660" height="130" rx="14" fill="#221848" stroke="#8B80D9" stroke-width="2"/>
  <text x="62" y="{foot_y + 93}" font-size="22" font-weight="700" fill="#FFFFFF">From the orchestrator</text>
  <text x="62" y="{foot_y + 127}" font-size="19" fill="#E4E1F5">· the test plan · runs per round · outcome</text>
  <text x="62" y="{foot_y + 159}" font-size="19" fill="#E4E1F5">· triage reports · remediations per round</text>

  <line x1="700" y1="370" x2="756" y2="370" stroke="#818CF8" stroke-width="2.5" marker-end="url(#arrow)"/>
  <polyline points="700,{foot_y + 120} 728,{foot_y + 120} 728,600 756,600" fill="none" stroke="#818CF8" stroke-width="2.5" marker-end="url(#arrow)"/>

  <!-- gate agent -->
  <rect x="760" y="260" width="420" height="420" rx="16" fill="#2B1F63" stroke="#818CF8" stroke-width="2.5"/>
  <text x="970" y="307" text-anchor="middle" font-size="26" font-weight="700" fill="#FFFFFF">Gate agent</text>
  <text x="970" y="335" text-anchor="middle" font-size="17" fill="#C4BFE6">Sonnet · rules applied to the evidence</text>
  <g font-size="19" fill="#E0E3FF">
    <text x="788" y="385" font-weight="700">Pass only if</text>
    <text x="788" y="415">· every selected workflow passed</text>
    <text x="803" y="441">  on the head commit</text>
    <text x="788" y="485" font-weight="700">Don't block on</text>
    <text x="788" y="515">· failures fixed in a later round</text>
    <text x="788" y="545">· flakes confirmed by a re-run</text>
    <text x="788" y="589" font-weight="700">Confidence from</text>
    <text x="788" y="619">· test levels covered</text>
    <text x="788" y="649">· final-commit evidence, flakiness</text>
  </g>

  <!-- outputs to GitHub -->
  <line x1="1180" y1="470" x2="1236" y2="470" stroke="#818CF8" stroke-width="2.5" marker-end="url(#arrow)"/>
  <text x="1240" y="240" font-size="20" font-weight="700" fill="#FFAB40">OUTPUTS · TO GITHUB</text>
  <rect x="1240" y="260" width="320" height="120" rx="14" fill="#143D2E" stroke="#4ADE80" stroke-width="2.5"/>
  <text x="1262" y="300" font-size="22" font-weight="700" fill="#BBF7D0">✓ quality-gate</text>
  <text x="1262" y="331" font-size="17" fill="#86EFAC">commit status on bbc6211</text>
  <text x="1262" y="357" font-size="17" fill="#86EFAC">with a one-line headline</text>

  <rect x="1240" y="410" width="320" height="110" rx="14" fill="#221848" stroke="#8B80D9" stroke-width="2"/>
  <text x="1262" y="450" font-size="22" font-weight="700" fill="#FFFFFF">Confidence 0–100</text>
  <text x="1262" y="481" font-size="17" fill="#C4BFE6">lowered by quarantined</text>
  <text x="1262" y="505" font-size="17" fill="#C4BFE6">or flaky coverage</text>

  <rect x="1240" y="550" width="320" height="130" rx="14" fill="#221848" stroke="#8B80D9" stroke-width="2"/>
  <text x="1262" y="590" font-size="22" font-weight="700" fill="#FFFFFF">Final PR comment</text>
  <text x="1262" y="621" font-size="17" fill="#C4BFE6">verdict · per-workflow table</text>
  <text x="1262" y="645" font-size="17" fill="#C4BFE6">caught → triaged → fixed</text>
  <text x="1262" y="669" font-size="17" fill="#C4BFE6">→ re-run, per round</text>
</svg>
'''
open("/Users/olensmar/Dev/ql-testcon-demo/docs/diagrams/06-gate.svg", "w").write(svg)
print("foot_y", foot_y, "orchestrator box ends", foot_y + 185)

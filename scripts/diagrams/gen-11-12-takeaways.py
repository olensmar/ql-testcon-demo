"""Generates the takeaway slides: docs/diagrams/11-takeaways.svg (1-4) and 12-takeaways.svg (5-7 + closing).
In proof text, words starting with '*' are highlighted; use non-breaking spaces to keep a highlight together."""
OUT = "/Users/olensmar/Dev/ql-testcon-demo/docs/diagrams/"
NB = " "
def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

T = [
    ("Run tests where they scale",
     f"Four workflows: *≈33{NB}s in parallel pods instead of *≈75{NB}s back to back, each against a fresh copy of the app built from the PR.",
     "Parallel runs and a clean environment per run are infrastructure, not a CI add-on."),
    ("AI test selection needs good test metadata",
     f"The Selector picked *5{NB}of{NB}6 workflows and explained every skip, using labels, coverage descriptions and health.",
     "Labelling and describing your tests is what makes AI selection possible."),
    ("Triage is the biggest win, if it brings proof",
     f"Root cause to file and line in *≈15{NB}s at *93–97% confidence. The flake was *proven by a re-run, not guessed.",
     "Expect evidence (logs, history, a re-run), not a confident guess."),
    ("Agents fix, the tests stay in charge",
     f"Fix → re-run the same plan → at most *2{NB}fix{NB}rounds → a human. Round 2 caught a second bug; out of rounds, the gate fails.",
     "Agents may not change tests to make them pass."),
    ("Guardrails in code, not in prompts",
     f"Plain-code orchestration. Each agent sees only its own tools (the Remediator: *none from Testkube). Only code pushes, labels and posts.",
     "Treat agents like test infrastructure: scoped, predictable, auditable."),
    ("A shared record makes it trustworthy",
     f"Every run is in Testkube, tagged with PR, commit and triage verdict. The Gate *re-checks{NB}the{NB}record, not the agents.",
     "If it isn't recorded, AI can't reason about it and you can't trust it."),
    ("Cheap next to the alternative",
     f"*3–5{NB}minutes and *≈$0.40–$1 of AI spend per PR loop. The agent that runs the tests costs *under{NB}a{NB}cent.",
     "Compare that with an engineer re-running and triaging a red pipeline."),
]

def wrap(text, max_chars):
    lines, cur = [], []
    for w in text.split(" "):
        plain = w.lstrip("*")
        if cur and len(" ".join(x.lstrip("*") for x in cur + [w])) > max_chars:
            lines.append(cur); cur = []
        cur.append(w)
    if cur: lines.append(cur)
    return lines

def line_svg(x, y, words, size, color, hl="#FFAB40", weight=None):
    w = f' font-weight="{weight}"' if weight else ""
    parts = []
    for i, word in enumerate(words):
        sep = " " if i else ""
        if word.startswith("*"):
            core = word[1:].rstrip(".,;:")
            tail = word[1 + len(core):]
            parts.append(f'{sep}<tspan fill="{hl}" font-weight="700">{esc(core)}</tspan>{esc(tail)}')
        else:
            parts.append(sep + esc(word))
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}"{w} xml:space="preserve">{"".join(parts)}</text>'

def card_height(*args, **kw):
    """Height the card's content needs (lays it out into a throwaway list)."""
    return card([], *args, **kw) + 34

def card(o, n, x, y, w, h, title, proof, qa, size=22, head=30):
    """Draws a takeaway card; returns the y of its last text line's bottom, relative to y."""
    chars = lambda px, fs: int(px / (fs * 0.47))
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="#221848" stroke="#8B80D9" stroke-width="2"/>')
    o.append(f'<circle cx="{x + 52}" cy="{y + 56}" r="27" fill="#FFAB40"/>')
    o.append(f'<text x="{x + 52}" y="{y + 66}" text-anchor="middle" font-size="28" font-weight="800" fill="#160F31">{n}</text>')
    ty = y + 66
    for words in wrap(title, chars(w - 125, head)):
        o.append(line_svg(x + 96, ty, words, head, "#FFFFFF", weight=700)); ty += head + 8
    ty += 18
    o.append(f'<text x="{x + 36}" y="{ty}" font-size="15" font-weight="700" fill="#FFAB40" letter-spacing="1">IN THE DEMO</text>')
    ty += 34
    for words in wrap(proof, chars(w - 72, size)):
        o.append(line_svg(x + 36, ty, words, size, "#E4E1F5")); ty += size + 11
    ty += 16
    o.append(f'<text x="{x + 36}" y="{ty}" font-size="15" font-weight="700" fill="#FFDB5B" letter-spacing="1">FOR QA</text>')
    ty += 34
    for words in wrap(qa, chars(w - 72, size)):
        o.append(line_svg(x + 36, ty, words, size, "#FFDB5B", weight=600)); ty += size + 11
    bottom = ty - size - 11 + 6
    assert bottom < y + h, f"card {n} overflows: {bottom} > {y + h}"
    return bottom - y

def svg(w, h, label, o):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{esc(label)}" '
            "font-family=\"Nunito, 'Helvetica Neue', Arial, sans-serif\">\n" + "\n".join("  " + l for l in o) + "\n</svg>\n")

# slide 11: 1-4 in a 2x2 grid, rows sized to their content
S11 = dict(size=24, head=32)
o = []
row_h = [max(card_height(i + 1, 0, 0, 750, 9999, *T[i], **S11) for i in (r * 2, r * 2 + 1)) for r in (0, 1)]
for i in range(4):
    x, y = 30 + (i % 2) * 790, 30 + (i // 2) * (row_h[0] + 36)
    card(o, i + 1, x, y, 750, row_h[i // 2], *T[i], **S11)
H11 = 30 + row_h[0] + 36 + row_h[1] + 30
open(OUT + "11-takeaways.svg", "w").write(svg(1600, H11,
    "Takeaways 1 to 4: run tests where they scale; AI test selection needs good test metadata; triage is the biggest win if it brings proof; agents fix, the tests stay in charge.", o))

# slide 12: 5-7 in a row, closing line below
S12 = dict(size=23, head=30)
o = []
h = max(card_height(i + 5, 0, 0, 500, 9999, *T[i + 4], **S12) for i in range(3))
for i in range(3):
    card(o, i + 5, 30 + i * 520, 30, 500, h, *T[i + 4], **S12)
b = 30 + h + 40
o.append(f'<rect x="30" y="{b}" width="1540" height="230" rx="18" fill="#2B1F63" stroke="#FFAB40" stroke-width="2.5"/>')
o.append(f'<text x="90" y="{b + 110}" font-size="120" font-weight="800" fill="#FFAB40">“</text>')
o.append(f'<text x="800" y="{b + 92}" text-anchor="middle" font-size="40" font-weight="800" fill="#FFFFFF">AI doesn\'t replace QA, it raises the bar for it.</text>')
o.append(f'<text x="800" y="{b + 150}" text-anchor="middle" font-size="27" fill="#E4E1F5">From running and triaging tests to curating them, labelling them,</text>')
o.append(f'<text x="800" y="{b + 190}" text-anchor="middle" font-size="27" fill="#E4E1F5">setting the gates and reviewing what the agents decided.</text>')
open(OUT + "12-takeaways.svg", "w").write(svg(1600, b + 260,
    "Takeaways 5 to 7: guardrails in code, not in prompts; a shared record makes it trustworthy; cheap next to the alternative. Closing: AI doesn't replace QA, it raises the bar for it, from running and triaging tests to curating them, labelling them, setting the gates and reviewing what the agents decided.", o))
print("ok")

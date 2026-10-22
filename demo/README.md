# Demo scenarios

`scripts/reset-demo.sh` builds the demo PR from `main` plus these patches, and sets up Testkube
for the chosen scenario:

| Scenario | Command | PR commits | Testkube state |
|---|---|---|---|
| Bug only | `reset-demo.sh` | `discount-codes.patch` | workflows restored |
| Flaky test | `reset-demo.sh --flaky` | `discount-codes.patch` | + `chaos` on `shop-e2e-browse` (`npm run flake -- on`) |
| Two bugs | `reset-demo.sh --two-bugs` | `discount-codes.patch`, then `second-bug.patch` | workflows restored |

- **`discount-codes.patch`**: the PR under test. Adds discount codes (API, UI, promo banner,
  tests) with the planted bug: the discount is computed on `subtotal + shipping`
  (`app/src/checkout.ts`). Unit tests pass; the API and E2E tests fail ($31.50 instead of $32.00).
- **`second-bug.patch`**: applied on top, as a second commit. The order summary shows
  `subtotal + shipping` as the total, ignoring the discount (`app/public/index.html`). The E2E
  test only reaches that check once the first bug is fixed, so the loop needs two fix rounds.
- **The flaky scenario has no patch on purpose**: the code is fine and the environment is
  flaky. The latency is injected by the workflow's `chaos` config (see
  `testkube/shop-e2e-browse.yaml`), so it fails on alternating runs and passes on a re-run.

To change a scenario, edit the code on a branch and regenerate the patch with `git diff`;
`git apply --check` both patches in order before committing.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export const REPO = process.env.DEMO_REPO ?? "olensmar/ql-testcon-demo";

/** Runs `gh`, retrying transient network failures (conference wifi). */
async function gh(args: string[], input?: string, attempts = 4): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      const child = run("gh", args, { maxBuffer: 16 * 1024 * 1024 });
      if (input !== undefined) child.child.stdin?.end(input);
      return (await child).stdout;
    } catch (err) {
      if (attempt >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

const ghRepo = (args: string[], input?: string) => gh([...args, "-R", REPO], input);

export interface PullRequest {
  number: number;
  title: string;
  body: string;
  url: string;
  headRefName: string;
  headRefOid: string;
  baseRefName: string;
  files: Array<{ path: string; additions: number; deletions: number }>;
}

export async function getPr(number: number): Promise<PullRequest> {
  const fields = "number,title,body,url,headRefName,headRefOid,baseRefName,files";
  return JSON.parse(await ghRepo(["pr", "view", String(number), "--json", fields]));
}

export async function getPrDiff(number: number): Promise<string> {
  return ghRepo(["pr", "diff", String(number)]);
}

export async function listOpenPrs(): Promise<Array<{ number: number; headRefOid: string; title: string }>> {
  return JSON.parse(await ghRepo(["pr", "list", "--state", "open", "--json", "number,headRefOid,title"]));
}

export async function comment(number: number, body: string): Promise<void> {
  await ghRepo(["pr", "comment", String(number), "--body-file", "-"], body);
}

export async function setStatus(
  sha: string,
  state: "pending" | "success" | "failure" | "error",
  description: string,
  targetUrl?: string,
): Promise<void> {
  const args = [
    "api",
    `repos/${REPO}/statuses/${sha}`,
    "-f", `state=${state}`,
    "-f", "context=quality-gate",
    "-f", `description=${description.slice(0, 140)}`,
  ];
  if (targetUrl) args.push("-f", `target_url=${targetUrl}`);
  // `gh api` takes the repo from the path, not -R
  await gh(args);
}

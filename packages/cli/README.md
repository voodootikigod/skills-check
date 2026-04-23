# skills-check

Quality & integrity layer for [Agent Skills](https://agentskills.io) — like `npm outdated` for skill knowledge.

Skills that reference versioned products (via `compatibility` or `product-version` in frontmatter) can drift as upstream packages ship new releases. `skills-check` detects this drift, audits security, lints metadata, analyzes token budgets, enforces policy, and more.

## Install

```bash
npm install -g skills-check
```

Or run directly:

```bash
npx skills-check check
```

## Quick Start

### 1. Initialize a registry

Scan your skills directory and map products to npm packages:

```bash
# Interactive — prompts for each mapping
skills-check init ./skills

# Non-interactive — auto-detects common packages
skills-check init ./skills --yes
```

This creates a `skills-check.json` registry file.

### 2. Check for staleness

```bash
skills-check check
```

Output:

```
skills-check
==================================================

STALE (2):
  Vercel AI SDK            6.0.105 → 6.1.0 (minor)
    skills: ai-sdk-core, ai-sdk-tools, ai-sdk-react, ai-sdk-multimodal

  Payload CMS              3.78.0 → 3.80.0 (minor)
    skills: payload-core, payload-data, payload-admin

CURRENT (15): upstash-redis, next, turbo, ...

Run "skills-check report --format markdown" for a full report.
```

### 3. Generate a report

```bash
# Markdown (for PRs, issues, dashboards)
skills-check report --format markdown > STALENESS.md

# JSON (for automation)
skills-check report --format json
```

## CLI Reference

### `skills-check init [dir]`

Scan a skills directory and generate a `skills-check.json` registry.

| Flag | Description |
|------|-------------|
| `-y, --yes` | Non-interactive mode, auto-detect package mappings |
| `-o, --output <path>` | Output path for registry file |

### `skills-check check`

Check skill versions against the npm registry.

| Flag | Description |
|------|-------------|
| `-r, --registry <path>` | Path to registry file (default: `./skills-check.json`) |
| `-p, --product <name>` | Check a single product |
| `--json` | Machine-readable JSON output |
| `-v, --verbose` | Show all products including current |
| `--ci` | Exit code 1 if any stale products found |

### `skills-check report`

Generate a full staleness report.

| Flag | Description |
|------|-------------|
| `-r, --registry <path>` | Path to registry file |
| `-f, --format <type>` | Output format: `json` or `markdown` (default: `markdown`) |

### `skills-check refresh [skills-dir]`

Use an LLM to propose targeted updates to stale skill files. Fetches changelogs, generates diffs, and optionally applies changes.

| Flag | Description |
|------|-------------|
| `-r, --registry <path>` | Path to registry file |
| `-p, --product <name>` | Refresh a single product |
| `--provider <name>` | LLM provider: `anthropic`, `openai`, `google` |
| `--model <id>` | Specific model ID (e.g. `claude-sonnet-4-20250514`) |
| `-y, --yes` | Auto-apply without confirmation |
| `--dry-run` | Show proposed changes, write nothing |

### `skills-check audit [dir]`

Security audit and hallucination detection for skill files. Scans for hallucinated package references, prompt injection patterns, dangerous shell commands, broken URLs, and incomplete metadata.

| Flag | Description |
|------|-------------|
| `-f, --format <type>` | Output format: `terminal`, `json`, `markdown`, or `sarif` (default: `terminal`) |
| `-o, --output <path>` | Write report to file |
| `--fail-on <severity>` | Exit code 1 threshold: `critical`, `high`, `medium`, `low` (default: `high`) |
| `--packages-only` | Only check package registries (fast) |
| `--skip-urls` | Skip URL liveness checks |
| `--unique-only` | Skip injection and command checkers |
| `--include-registry-audits` | Fetch Snyk/Socket/Gen results from skills.sh |
| `--ignore <path>` | Path to `.skills-checkignore` file |
| `--verbose` | Show progress and scan details |
| `--quiet` | Suppress output, exit code only |

Example:
```bash
skills-check audit ./skills --fail-on high
```

### `skills-check budget [dir]`

Measure token cost and detect redundancy in skill files. Analyzes how much context window each skill consumes and identifies overlap between skills.

| Flag | Description |
|------|-------------|
| `-s, --skill <name>` | Analyze a specific skill by name |
| `-d, --detailed` | Show per-section token breakdown |
| `-f, --format <type>` | Output format: `terminal`, `json`, or `markdown` (default: `terminal`) |
| `-o, --output <path>` | Write report to file |
| `--max-tokens <n>` | Exit code 1 if total exceeds this threshold |
| `--save <path>` | Save a snapshot for later comparison |
| `--compare <path>` | Compare current budget against a saved snapshot |
| `--model <name>` | Model for cost estimation: `claude-opus`, `claude-sonnet`, `claude-haiku`, `gpt-4o` |

Example:
```bash
skills-check budget ./skills --max-tokens 50000
```

### `skills-check verify`

Verify that skill version bumps match content changes. Validates that the declared semver bump (major/minor/patch) is appropriate for the actual content diff.

| Flag | Description |
|------|-------------|
| `-s, --skill <path>` | Verify a single skill file or directory |
| `-a, --all` | Verify all discovered skills |
| `--before <path>` | Path to previous version of skill |
| `--after <path>` | Path to current version of skill |
| `--suggest` | Suggest appropriate version bump |
| `-f, --format <type>` | Output format: `terminal` or `json` (default: `terminal`) |
| `-o, --output <path>` | Write report to file |
| `--provider <name>` | LLM provider: `anthropic`, `openai`, `google` |
| `--model <id>` | Specific model ID |
| `--skip-llm` | Disable LLM-assisted analysis |
| `--verbose` | Show progress and details |
| `--quiet` | Suppress output, exit code only |

Example:
```bash
skills-check verify --all --suggest
```

### `skills-check lint [dir]`

Validate metadata completeness, structural quality, and format in skill files. Auto-fix mode can fill in missing fields from git context.

| Flag | Description |
|------|-------------|
| `--fix` | Auto-fix missing fields from git context |
| `--ci` | Strict CI mode |
| `--fail-on <level>` | Exit code 1 threshold: `error`, `warning` (default: `error`) |
| `-f, --format <type>` | Output format: `terminal` or `json` (default: `terminal`) |
| `-o, --output <path>` | Write report to file |

Example:
```bash
skills-check lint --fix
```

### `skills-check policy <subcommand>`

Enforce organizational policy rules for skill files via `.skill-policy.yml`.

#### `skills-check policy check [dir]`

Check all installed skills against organizational policy.

| Flag | Description |
|------|-------------|
| `--policy <path>` | Path to `.skill-policy.yml` |
| `-s, --skill <name>` | Check a specific skill by name |
| `--ci` | Strict exit codes |
| `-f, --format <type>` | Output format: `terminal` or `json` (default: `terminal`) |
| `-o, --output <path>` | Write report to file |
| `--fail-on <severity>` | Exit code 1 threshold: `blocked`, `violation`, `warning` (default: `blocked`) |

#### `skills-check policy init`

Generate a starter `.skill-policy.yml` file.

| Flag | Description |
|------|-------------|
| `-o, --output <path>` | Output path for policy file |

#### `skills-check policy validate`

Validate a `.skill-policy.yml` file for correctness.

| Flag | Description |
|------|-------------|
| `--policy <path>` | Path to `.skill-policy.yml` |

Example:
```bash
skills-check policy check --ci --fail-on violation
```

### `skills-check test [dir]`

Run eval test suites declared in skill `tests/` directories. Supports multiple agent harnesses, rubric-based grading, regression detection, and budget caps.

| Flag | Description |
|------|-------------|
| `-s, --skill <name>` | Test a specific skill by name |
| `-t, --type <type>` | Filter by test type: `trigger`, `outcome`, `style`, `regression` |
| `--agent <name>` | Agent harness: `claude-code`, `generic` (default: `generic`) |
| `--agent-cmd <command>` | Custom command template for generic harness |
| `-f, --format <type>` | Output format: `terminal`, `json`, or `markdown` (default: `terminal`) |
| `-o, --output <path>` | Write report to file |
| `--trials <n>` | Runs per test case |
| `--pass-threshold <n>` | Trials that must pass |
| `--timeout <seconds>` | Per-case timeout |
| `--max-cost <dollars>` | Budget cap for test run |
| `--dry` | Show test plan without executing |
| `--update-baseline` | Accept current results as new baseline |
| `--ci` | Strict exit codes (exit 1 on regressions) |
| `--provider <name>` | LLM provider for rubric grading: `anthropic`, `openai`, `google` |
| `--model <id>` | Model for rubric grading |
| `--verbose` | Show per-grader results |

Example:
```bash
skills-check test --agent claude-code
```

### `skills-check fingerprint [dir]`

Generate a fingerprint registry of installed skills with content hashes and watermarks for integrity verification and runtime detection.

| Flag | Description |
|------|-------------|
| `-o, --output <path>` | Write registry to file |
| `--inject-watermarks` | Add watermark comments to skills that lack them |
| `--json` | Output as JSON |
| `--ci` | Strict exit codes |
| `--verbose` | Show progress and details |
| `--quiet` | Suppress output, exit code only |

Example:
```bash
skills-check fingerprint ./skills --json -o fingerprints.json
```

### `skills-check usage`

Analyze skill telemetry events to track usage frequency, version drift, cost estimation, and enforce usage policies.

| Flag | Description |
|------|-------------|
| `--store <uri>` | Telemetry store URI (`file://path.jsonl` or `sqlite://path.db`) |
| `--since <date>` | Filter events after this date |
| `--until <date>` | Filter events before this date |
| `--check-policy` | Cross-reference usage against `.skill-policy.yml` |
| `--policy <path>` | Path to policy file |
| `--detailed` | Show detailed per-skill breakdown |
| `--format <fmt>` | Output format: `terminal`, `json`, `markdown` |
| `--json` | Shorthand for `--format json` |
| `--markdown` | Shorthand for `--format markdown` |
| `-o, --output <path>` | Write output to file |
| `--ci` | Strict exit codes |
| `--fail-on <severity>` | Fail threshold for policy violations |
| `--verbose` | Show progress |
| `--quiet` | Suppress output |

Example:
```bash
skills-check usage --store file://telemetry.jsonl --check-policy --ci
```

### `skills-check doctor`

Validate environment prerequisites and release readiness.

| Flag | Description |
|------|-------------|
| `--format <format>` | Output format: `terminal` or `json` (default: `terminal`) |
| `--ci` | Exit with non-zero code on errors |

Example:
```bash
skills-check doctor --ci
```

### `skills-check fix [dir]`

Apply deterministic autofixes to skill files.

| Flag | Description |
|------|-------------|
| `--write` | Apply fixes (default is dry-run) |
| `--format <format>` | Output format: `terminal` or `json` (default: `terminal`) |

Example:
```bash
skills-check fix ./skills --write
```

### `skills-check health [dir]`

Run audit + lint + budget + policy as a single CI gate.

| Flag | Description |
|------|-------------|
| `-f, --format <type>` | Output format: `terminal` or `json` (default: `terminal`) |
| `-o, --output <path>` | Write report to file |
| `--max-tokens <n>` | Budget threshold for token count |
| `--skip-audit` | Skip audit check |
| `--skip-lint` | Skip lint check |
| `--skip-budget` | Skip budget check |
| `--skip-policy` | Skip policy check |
| `--verbose` | Show progress and details |
| `--quiet` | Suppress output, exit code only |

Example:
```bash
skills-check health --quiet
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All checks pass / no findings above threshold |
| `1` | Findings detected at or above the configured threshold |
| `2` | Configuration error (missing registry, bad format, invalid options) |

## Registry Format

The `skills-check.json` file maps products to npm packages:

```json
{
  "$schema": "https://skillscheck.ai/schema.json",
  "version": 1,
  "lastCheck": "2026-02-28T00:00:00Z",
  "products": {
    "ai-sdk": {
      "displayName": "Vercel AI SDK",
      "package": "ai",
      "verifiedVersion": "6.0.105",
      "verifiedAt": "2026-02-28T00:00:00Z",
      "changelog": "https://github.com/vercel/ai/releases",
      "skills": ["ai-sdk-core", "ai-sdk-tools", "ai-sdk-react"],
      "agents": ["ai-sdk-engineer"]
    }
  }
}
```

## Skill Frontmatter

Skills declare their product version in YAML frontmatter:

```yaml
---
name: ai-sdk-core
description: "Generate text with Vercel AI SDK..."
compatibility: "ai@^6.0.0"
---
```

The spec-native `compatibility` field uses `package@semver` format (e.g., `"next@^15.0.0, react@19.0.0"`). The legacy `product-version` field is still supported as a fallback.

## CI Integration

For GitHub Actions, use the official [skills-check action](https://github.com/voodootikigod/skills-check).

For other CI environments, run individual commands directly:

```yaml
- name: Check skill freshness
  run: npx skills-check check --ci

- name: Audit skill security
  run: npx skills-check audit --fail-on high --quiet
```

## License

MIT

# GitHub Issues Backlog

Prepared from the April 12, 2026 production-readiness audit.

GitHub write access was unavailable in the current session, so these issues were not created remotely. Existing related issues:

- `#5` `fix: harden test command against command injection from untrusted cases.yaml`
- `#6` `fix: pin npx skills-check version in action.yml to prevent supply chain attacks`

## 1. tracking: production readiness and roadmap hardening audit

### Summary

Track the release-hardening backlog identified in the April 12, 2026 production-readiness audit.

This issue should serve as the umbrella tracker for the remaining blockers and roadmap additions. The two existing overlapping blockers are:

- `#5` test command injection / trust-boundary hardening
- `#6` GitHub Action execution source and supply-chain hardening

### Release blockers

- CI and publish workflows are not reproducible from a clean checkout
- Shell-string execution remains in critical testing paths
- Isolated test execution is serialized through shell strings and detached from checked-out source
- CI can fall back to unsafe local execution when isolation is unavailable
- Runtime support declarations are inconsistent across the repo

### Exit criteria

- [ ] CI and publish are reproducible from a clean checkout
- [ ] Critical shell-string execution paths are removed or tightly constrained
- [ ] Isolated test execution uses structured argv and checked-out source
- [ ] Unsafe CI fallback behavior is removed
- [ ] Runtime and docs contracts are aligned
- [ ] Security automation baseline is enabled

### Related issues

- `#5`
- `#6`
- Link the issues below once created

---

## 2. fix: migrate CI and publish workflows from npm to pnpm

### Problem

The repository declares PNPM as the package manager and only includes `pnpm-lock.yaml`, but both CI and publish workflows currently use `npm ci`. The workflows also trigger on `package-lock.json`, which does not exist in the repository.

This makes the release path non-reproducible and currently broken from a clean checkout.

### Evidence

- Root package manager declaration: `packageManager: pnpm@10.24.0`
- `pnpm-lock.yaml` exists
- `package-lock.json` does not exist
- `.github/workflows/ci.yml` runs `npm ci`
- `.github/workflows/publish.yml` runs `npm ci`

### Files

- `package.json`
- `.github/workflows/ci.yml`
- `.github/workflows/publish.yml`

### Required changes

- Replace npm setup/install flow with PNPM-native setup
- Add `pnpm/action-setup`
- Use `pnpm install --frozen-lockfile`
- Configure dependency caching for PNPM
- Trigger workflows on `pnpm-lock.yaml` instead of `package-lock.json`
- Verify workspace-aware build/test commands run correctly in CI

### Acceptance criteria

- [ ] Fresh GitHub runner can install dependencies from scratch
- [ ] `build`, `lint`, `typecheck`, and `test` pass in CI using PNPM
- [ ] Publish workflow uses PNPM consistently
- [ ] Workflow triggers watch the correct lockfile

### Priority

P0 release blocker

---

## 3. fix: refactor isolated test execution to use argv and checked-out source

### Problem

The isolated `skills-check test` execution path currently serializes CLI options into a single command string and passes that through shell execution inside the isolation provider.

This introduces parsing fragility, makes command behavior diverge from the non-isolated path, and runs code that is detached from the checked-out repository by installing the npm package inside the container.

### Evidence

- `commands/test.ts` builds a command string from CLI args
- `isolation/providers/oci.ts` wraps execution via `sh -c`
- OCI path installs `skills-check` from npm instead of using repo source

### Files

- `packages/cli/src/commands/test.ts`
- `packages/cli/src/isolation/providers/oci.ts`
- any shared isolation interfaces/types

### Required changes

- Refactor isolation provider contract to accept argv arrays rather than a single shell command string
- Remove shell-based CLI reconstruction from `test`
- Mount and execute the checked-out workspace or built local artifacts in the container
- Ensure isolated and non-isolated execution parse the same options identically
- Document the isolation model clearly

### Acceptance criteria

- [ ] Isolation providers accept structured argv
- [ ] No critical `sh -c` wrapping for CLI argument transport
- [ ] Container execution uses checked-out source or built local artifacts
- [ ] Isolated and local runs produce equivalent argument handling

### Priority

P0 release blocker

---

## 4. fix: fail closed in CI when no isolation runtime is available

### Problem

The `test` command currently continues in CI when no isolation runtime is available. That behavior can run agent harnesses directly on the runner, including high-trust modes that intentionally disable permission checks.

For CI, this should fail closed rather than warn and continue.

### Evidence

- CI path currently allows fallback to local execution
- Claude harness uses `--dangerously-skip-permissions`

### Files

- `packages/cli/src/commands/test.ts`
- `packages/cli/src/testing/harness/claude-code.ts`
- related docs

### Required changes

- In CI, exit with an error when isolation is requested but unavailable
- Require an explicit local-only override for unsafe execution modes
- Revisit whether dangerous harness flags should be exposed by default
- Document the trust boundary for all test harnesses

### Acceptance criteria

- [ ] CI never silently falls back to local unsafe execution
- [ ] Unsafe local overrides require explicit opt-in
- [ ] Harness trust model is documented

### Priority

P1 high priority

---

## 5. fix: unify Node runtime requirements across repo, package, CI, and docs

### Problem

Node version requirements are inconsistent. The monorepo root requires Node 22, while the published CLI package claims support for Node 18+. At the same time, some functionality depends on Node 22 features such as `node:sqlite`.

This creates support ambiguity and production risk.

### Evidence

- Root `engines.node` is `>=22`
- CLI package `engines.node` is `>=18`
- usage telemetry includes a Node 22-specific SQLite reader

### Files

- `package.json`
- `packages/cli/package.json`
- `packages/cli/src/usage/readers/sqlite.ts`
- docs and README

### Required changes

- Choose and document one supported minimum Node version
- Align root package, CLI package, CI, publish, and docs
- Make feature gating explicit if mixed support is retained

### Acceptance criteria

- [ ] Runtime declarations match across all package manifests
- [ ] CI and publish use the documented supported version
- [ ] Docs and error messages reflect the actual support policy

### Priority

P1 high priority

---

## 6. docs: correct invalid command examples and add trust-boundary guidance

### Problem

The docs include at least one invalid command example and do not clearly explain trust boundaries around commands that execute code or contact external systems.

This will create support churn and unsafe operator expectations.

### Evidence

- Docs include `audit --fail-on warning`, but valid values are `critical`, `high`, `medium`, `low`

### Files

- `packages/web/app/docs/page.tsx`
- `README.md`
- any command reference pages

### Required changes

- Correct invalid CLI examples
- Add a section explaining trusted vs. untrusted execution
- Document isolation expectations for `test`
- Clarify which commands are deterministic vs. LLM-assisted vs. externally networked

### Acceptance criteria

- [ ] All command examples are valid
- [ ] Trust-boundary and execution-risk guidance is documented
- [ ] Docs are consistent across README and website

### Priority

P1 high priority

---

## 7. security: add repository security baseline and dependency automation

### Summary

Establish a baseline security posture for the repository itself.

This project is positioned as a security and quality tool for agent skills, so the repo should hold itself to a higher operational standard.

### Scope

- Add `SECURITY.md`
- Add Dependabot or Renovate
- Add CodeQL
- Add dependency audit or OSV scanning in CI
- Add SBOM generation during release

### Why

- Improve supply-chain visibility
- Reduce time-to-detect for vulnerable dependencies
- Provide a documented disclosure path
- Align project operations with product positioning

### Acceptance criteria

- [ ] Security disclosure process is documented
- [ ] Dependency updates are automated
- [ ] Static/code scanning runs on PRs
- [ ] Release flow emits or stores an SBOM

### Priority

P2 medium priority

---

## 8. test: add adversarial regression coverage for execution and isolation paths

### Summary

Add exploit-shaped regression tests for execution, parsing, and isolation-sensitive code paths.

### Scope

- Hostile prompt strings for generic harness
- Shell metacharacters and quoting edge cases
- Isolation argv parity tests
- SSRF/private-network URL fixtures
- Typo-package and prompt-injection fixtures

### Files

- `packages/cli/src/testing/harness/generic.test.ts`
- `packages/cli/src/isolation/providers/oci.test.ts`
- audit checker tests
- any related integration tests

### Required changes

- Add negative tests that mirror real exploit shapes
- Ensure CI exercises these regressions
- Verify shell-string execution is not reintroduced

### Acceptance criteria

- [ ] Malicious prompt and quoting payloads are covered
- [ ] Isolation behavior is tested for argv parity
- [ ] SSRF and supply-chain style fixtures are covered

### Priority

P2 medium priority

---

## 9. feature: add skills-check doctor for environment and release readiness

### Summary

Add a diagnostic command that validates environment prerequisites and release-readiness assumptions.

### Motivation

This would reduce operator confusion and catch setup drift earlier, including package-manager mismatches, missing isolation runtimes, unsupported Node versions, and missing API keys.

### Proposed scope

- Validate Node version
- Validate package manager / lockfile consistency
- Validate registry/network reachability
- Detect available isolation runtimes
- Detect installed provider SDKs and API key env vars
- Emit terminal and JSON output

### Acceptance criteria

- [ ] `skills-check doctor` exists
- [ ] Terminal and JSON output are supported
- [ ] CI can fail on invalid environment assumptions

### Priority

Roadmap feature

---

## 10. feature: add deterministic skills-check fix mode for safe autofixes

### Summary

Add a deterministic non-LLM autofix path for safe repairs.

### Motivation

Today there is a gap between validation and LLM-assisted `refresh`. A deterministic `fix` mode would support safer CI/autofix workflows and give operators a trusted option for routine normalization.

### Proposed scope

- Frontmatter normalization
- Metadata repair
- Registry scaffolding and alignment
- Safe docs/example normalization
- Dry-run plus write modes

### Acceptance criteria

- [ ] Only deterministic transforms are applied
- [ ] Dry-run and write modes are supported
- [ ] Output clearly shows proposed and applied changes

### Priority

Roadmap feature

---

## 11. feature: add enterprise policy packs, signed fingerprints, and drift bot automation

### Summary

Explore the next step beyond CLI checking by turning `skills-check` into a governance and provenance layer.

### Proposed areas

- Reusable organization policy packs
- Signed or attested fingerprint outputs
- Automated drift bot for stale packages, broken links, and policy regressions

### Why

This is the strongest long-term roadmap direction from the audit. It expands the product from local checking into enforceable governance and trust infrastructure.

### Suggested approach

- Start with a design issue or RFC
- Split implementation into separate issues after the architecture is defined

### Acceptance criteria

- [ ] Design or RFC exists
- [ ] MVP scope is broken into implementation tickets

### Priority

Roadmap / strategic

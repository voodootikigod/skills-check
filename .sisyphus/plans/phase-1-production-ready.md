# Phase 1: Production-Ready

> **Goal**: Make skills-check trustworthy in a real CI pipeline. After Phase 1, a team can add `skills-check health --frozen-lockfile` to CI and enforce skill governance with exemptions, tamper detection, and deprecation controls.
>
> **Scope exclusions**: No registry work. No deep security analysis (Snyk's domain). No cryptographic signatures (Ed25519 deferred to Phase 2). No remote revocation feeds. No inline comment suppression for policy.
>
> **Design decisions baked in**:
> 1. Lock file: Clean v2 replacement (current stub has 1 consumer)
> 2. Exemptions: In `.skill-policy.yml` only (cargo-deny style)
> 3. `--frozen-lockfile` when lock missing: Hard-fail (npm model)
> 4. Revocation: Local `.skill-revocations.json` only
> 5. `max_version_drift`: Stays stubbed in freshness; delegated to audit-integration

---

## Wave 1: Foundation (Schema + Lock File + Exemptions + Test Gaps)

Three workstreams run in parallel after the schema types land. Schema types are the first task because Lock File, Exemptions, and Revocation (Wave 3) all depend on shared types.

### 1A. Schema Types (must land first, blocks everything)

**Files**: `packages/schema/src/types.ts`, `packages/schema/src/index.ts`

**Add `SkillsLockFile` type**:
```typescript
export interface SkillsLockFileEntry {
  /** Skill name (directory basename or frontmatter name) */
  name: string;
  /** Resolved source URI (file path, git URL, registry URL) */
  source: string;
  /** SHA-256 content hash from fingerprint */
  contentHash: string;
  /** SHA-256 frontmatter hash from fingerprint */
  frontmatterHash: string;
  /** SHA-256 prefix hash from fingerprint */
  prefixHash: string;
  /** Watermark string injected by fingerprint command */
  watermark?: string;
  /** Estimated token count at time of lock */
  tokenCount?: number;
  /** ISO 8601 timestamp when this entry was resolved */
  resolvedAt: string;
  /** Semver version from frontmatter, if present */
  version?: string;
  /** Skill status */
  status?: 'active' | 'deprecated' | 'revoked';
  /** Deprecation message if status is deprecated */
  deprecatedMessage?: string;
  /** Deprecation sunset date (ISO 8601) if status is deprecated */
  deprecatedSunsetDate?: string;
}

export interface SkillsLockFile {
  /** Lock file format version for forward compatibility */
  lockfileVersion: 2;
  /** Tool and version that generated this lock file */
  generatedBy: string;
  /** ISO 8601 timestamp of last generation */
  generatedAt: string;
  /** Map of skill name -> locked entry */
  skills: Record<string, SkillsLockFileEntry>;
}
```

**Add `PolicyExemption` type**:
```typescript
export interface PolicyExemption {
  /** Skill name or glob pattern (e.g., "my-skill" or "internal/*") */
  skill: string;
  /** Validator rule ID to exempt (e.g., "banned-pattern", "source-not-allowed") */
  rule: string;
  /** Human-readable reason for the exemption */
  reason: string;
  /** ISO 8601 expiry date (exemption auto-expires and starts failing) */
  expires?: string;
  /** Who granted the exemption */
  grantedBy?: string;
}
```

**Extend `FingerprintEntry`**:
```typescript
// ADD to existing FingerprintEntry interface:
status?: 'active' | 'deprecated' | 'revoked';
deprecatedMessage?: string;
```

**Tasks**:
- [ ] Add `SkillsLockFile`, `SkillsLockFileEntry` types to `packages/schema/src/types.ts`
- [ ] Add `PolicyExemption` type to `packages/schema/src/types.ts`
- [ ] Add `status`, `deprecatedMessage` fields to `FingerprintEntry`
- [ ] Export all new types from `packages/schema/src/index.ts`
- [ ] Run `pnpm run typecheck` from root (must pass)
- [ ] Run `pnpm run build` from root (must pass)
- [ ] Verify skills-trace still compiles: `cd ../skills-trace && pnpm run typecheck` (should pass since it duplicates types rather than importing, but verify no naming collisions)

**Acceptance**: All new types exported, build green, no type errors.

---

### 1B. Lock File Overhaul (after 1A)

**New files**:
- `packages/cli/src/lockfile/index.ts` - Read/write/diff lock file
- `packages/cli/src/lockfile/index.test.ts` - Unit tests
- `packages/cli/src/lockfile/migrate.ts` - Migrate v1 stub to v2 format

**Modified files**:
- `packages/cli/src/commands/fingerprint.ts` - Auto-update lock file after fingerprinting
- `packages/cli/src/commands/refresh.ts` - Auto-update lock file after refresh
- `packages/cli/src/commands/health.ts` - Add `--frozen-lockfile` flag
- `packages/cli/src/commands/report.ts` - Include lock file drift in report output
- `skills-lock.json` (root) - Migrate to v2 format

**Implementation pattern**: Follow `packages/cli/src/registry.ts` for file I/O patterns (JSON read/write, error handling).

#### Lock File Module (`packages/cli/src/lockfile/index.ts`)

```typescript
// Core API surface:
export function readLockFile(dir: string): SkillsLockFile | null;
export function writeLockFile(dir: string, lock: SkillsLockFile): void;
export function updateLockEntry(lock: SkillsLockFile, entry: FingerprintEntry): SkillsLockFile;
export function diffLockFiles(prev: SkillsLockFile, next: SkillsLockFile): LockFileDiff;
export function migrateLockFileV1(v1: unknown): SkillsLockFile;

export interface LockFileDiff {
  added: string[];      // skill names
  removed: string[];    // skill names
  changed: Array<{
    name: string;
    field: string;
    from: string;
    to: string;
  }>;
  unchanged: string[];
}
```

#### `--frozen-lockfile` behavior:
1. If lock file missing: **hard-fail** with error message and exit code 1
2. If lock file exists but would change (new skills detected, hashes differ): **hard-fail** with diff output
3. If lock file matches current state: **pass silently**

**Tasks**:
- [ ] Create `packages/cli/src/lockfile/index.ts` with `readLockFile`, `writeLockFile`, `updateLockEntry`, `diffLockFiles`
- [ ] Create `packages/cli/src/lockfile/migrate.ts` with `migrateLockFileV1` (converts current stub format)
- [ ] Wire `fingerprint` command to call `updateLockEntry` after successful fingerprinting
- [ ] Wire `refresh` command to call `updateLockEntry` after successful refresh
- [ ] Add `--frozen-lockfile` option to `health` command (Commander option)
- [ ] In `health` command: if `--frozen-lockfile`, read lock → compute current state → diff → fail if changed
- [ ] Add lock file diff output to `report` command (show what changed since last lock)
- [ ] Migrate root `skills-lock.json` to v2 format
- [ ] Write unit tests for all lockfile module functions (`packages/cli/src/lockfile/index.test.ts`)
- [ ] Write integration test: fingerprint → verify lock file updated → read back → validate

**Acceptance**: `skills-check fingerprint` auto-updates `skills-lock.json` in v2 format. `skills-check health --frozen-lockfile` fails if lock would change. All lock file functions have unit tests.

---

### 1C. Policy Exemption System (after 1A, parallel with 1B)

**Modified files**:
- `packages/cli/src/policy/types.ts` - Import `PolicyExemption`, extend `SkillPolicy`
- `packages/cli/src/policy/parser.ts` - Parse `exemptions` section from YAML
- `packages/cli/src/policy/parser.test.ts` - Test exemption parsing
- `packages/cli/src/policy/index.ts` - Filter violations through exemptions AFTER validators run
- `packages/cli/src/policy/reporters/terminal.ts` - Show exempted findings (dimmed/separate section)
- `packages/cli/src/policy/reporters/json.ts` - Include `exemptions` and `exemptedViolations` in output
- `packages/cli/src/policy/reporters/sarif.ts` - Mark exempted results with `suppressions` array (SARIF 2.1.0 spec)
- `packages/cli/src/policy/reporters/markdown.ts` - Exempted section in output
- `packages/cli/src/commands/policy.ts` - Add `--show-exemptions` flag

#### Policy File Format Addition

```yaml
# .skill-policy.yml (new section)
exemptions:
  - skill: "legacy-deploy-skill"
    rule: "banned-pattern"
    reason: "Uses exec for legacy deployment scripts, migrating in Q3"
    expires: "2025-09-30"
    grantedBy: "jane@company.com"
  - skill: "internal/*"
    rule: "source-not-allowed"
    reason: "Internal skills hosted on private registry"
```

#### Exemption Evaluation Logic

**Critical**: Filter exemptions AFTER validators run, not during. Validators must not know about exemptions. This keeps validators pure and testable.

```typescript
// In packages/cli/src/policy/index.ts
function applyExemptions(
  violations: PolicyViolation[],
  exemptions: PolicyExemption[]
): { active: PolicyViolation[]; exempted: PolicyViolation[] } {
  // 1. For each violation, check if any exemption matches (skill glob + rule ID)
  // 2. Check expiry: if exemption.expires < now, it's expired → violation stays active
  // 3. Return both lists so reporters can show what was exempted
}
```

**Tasks**:
- [ ] Add `exemptions?: PolicyExemption[]` to `SkillPolicy` in `packages/cli/src/policy/types.ts`
- [ ] Update YAML parser to handle `exemptions` array in `packages/cli/src/policy/parser.ts`
- [ ] Add exemption parsing tests to `packages/cli/src/policy/parser.test.ts` (valid, expired, glob patterns, missing fields)
- [ ] Implement `applyExemptions()` in `packages/cli/src/policy/index.ts` — AFTER validators, before reporters
- [ ] Handle expired exemptions: treat as active violations, include warning "exemption expired"
- [ ] Implement glob matching for skill names (use `minimatch` or `picomatch` — check if already a dependency)
- [ ] Update terminal reporter: show exempted findings in dimmed/italic section
- [ ] Update JSON reporter: add `exemptions` and `exemptedViolations` fields
- [ ] Update SARIF reporter: use SARIF `suppressions` array on exempted results (standard field)
- [ ] Update markdown reporter: add "Exempted Findings" section
- [ ] Add `--show-exemptions` flag to `policy` command (default: hide exempted, flag shows them)
- [ ] Write unit tests for `applyExemptions()` (match, no match, expired, glob, multiple exemptions)
- [ ] Write integration test: policy with exemptions → verify violation count matches

**Acceptance**: `.skill-policy.yml` with `exemptions` section correctly suppresses matching violations. Expired exemptions fail. `--show-exemptions` displays what was suppressed. SARIF output uses standard `suppressions` field.

---

### 1D. Test Gap Remediation (parallel with 1B and 1C)

Address the three critical test blind spots identified in the gap analysis. These are for EXISTING untested code, not new Phase 1 code (new code gets tests inline).

**New files**:
- `packages/cli/src/usage/readers/sqlite.test.ts`
- `packages/cli/src/policy/reporters/terminal.test.ts`
- `packages/cli/src/policy/reporters/json.test.ts`
- `packages/cli/src/policy/reporters/sarif.test.ts`
- `packages/cli/src/policy/reporters/markdown.test.ts`
- `packages/cli/test/e2e/health-pipeline.test.ts`

#### 1D.1: SQLiteReader Tests

- [ ] Create `packages/cli/src/usage/readers/sqlite.test.ts`
- [ ] Test: reads valid SQLite database with telemetry events
- [ ] Test: handles missing/corrupt database file gracefully
- [ ] Test: deduplication works correctly
- [ ] Test: date range filtering works
- [ ] Use temp directory with real SQLite file (not mocks — this is the gap)
- [ ] Verify against JSONL reader output for same dataset (cross-validate)

#### 1D.2: Reporter Snapshot Tests

For each reporter (terminal, JSON, markdown, SARIF):
- [ ] Create test file in `packages/cli/src/policy/reporters/<name>.test.ts`
- [ ] Test with zero violations (clean output)
- [ ] Test with multiple violations across different rules
- [ ] Test with mixed severities (error, warning, info)
- [ ] Use Vitest `toMatchSnapshot()` for output stability
- [ ] For SARIF: validate output against SARIF 2.1.0 schema (JSON Schema validation)

#### 1D.3: E2E Pipeline Test

- [ ] Create `packages/cli/test/e2e/health-pipeline.test.ts`
- [ ] Set up fixture directory with real SKILL.md files (valid + invalid)
- [ ] Set up fixture `.skill-policy.yml`
- [ ] Run `health` command programmatically against fixtures
- [ ] Assert: exit code, output format, violation count
- [ ] Assert: audit + lint + budget + policy all execute
- [ ] This test must NOT mock any module — real file I/O, real validators

**Acceptance**: `pnpm test` passes with SQLite, reporter, and E2E tests. Coverage for existing code measurably improved.

---

## Wave 2: Tamper Detection (blocked by Wave 1B — Lock File)

**Modified files**:
- `packages/cli/src/lockfile/index.ts` - Add `verifyIntegrity()` function
- `packages/cli/src/lockfile/index.test.ts` - Integrity verification tests
- `packages/cli/src/registry.ts` - Add hash verification on registry load
- `packages/cli/src/commands/verify.ts` - Wire integrity check into verify command
- `packages/cli/src/commands/health.ts` - Add integrity check to health pipeline

#### Integrity Verification

```typescript
// Add to packages/cli/src/lockfile/index.ts
export interface IntegrityResult {
  skill: string;
  status: 'ok' | 'modified' | 'missing' | 'new';
  expected?: string;  // hash from lock file
  actual?: string;    // hash from current file
  field?: string;     // which hash differs (contentHash, frontmatterHash, prefixHash)
}

export function verifyIntegrity(
  lock: SkillsLockFile,
  currentFingerprints: FingerprintRegistry
): IntegrityResult[];
```

#### Verification behavior:
1. On `health` command (always): compare current hashes vs lock file hashes
2. `modified` → **warning** by default, **error** with `--frozen-lockfile`
3. `missing` (skill in lock but not on disk) → **error** always
4. `new` (skill on disk but not in lock) → **warning** by default, **error** with `--frozen-lockfile`

**Tasks**:
- [ ] Implement `verifyIntegrity()` in lockfile module
- [ ] Wire into `health` command: run after fingerprinting, before policy
- [ ] Wire into `verify` command: add `--check-integrity` flag
- [ ] Add integrity results to all output formats (terminal, JSON, SARIF, markdown)
- [ ] Unit tests: all 4 status cases (ok, modified, missing, new)
- [ ] Unit tests: hash field identification (which specific hash changed)
- [ ] Integration test: modify a SKILL.md → run health → verify tamper detected

**Acceptance**: Modified skill files are detected and reported. `--frozen-lockfile` fails on any integrity mismatch.

---

## Wave 3: Revocation & Deprecation (blocked by Wave 1A schema + Wave 1C exemptions)

**New files**:
- `packages/cli/src/revocation/index.ts` - Read/check revocation list
- `packages/cli/src/revocation/index.test.ts` - Unit tests

**Modified files**:
- `packages/cli/src/commands/audit.ts` - Check revocations during audit
- `packages/cli/src/commands/health.ts` - Add `--check-revocations` flag
- `packages/cli/src/scanner.ts` - Parse `deprecated` and `deprecatedMessage` from frontmatter

#### Revocation List Format (`.skill-revocations.json`)

```json
{
  "revocationVersion": 1,
  "updatedAt": "2025-04-18T00:00:00Z",
  "entries": [
    {
      "skill": "malicious-skill",
      "reason": "Contains prompt injection targeting financial data",
      "revokedAt": "2025-04-15T00:00:00Z",
      "severity": "critical",
      "advisory": "https://example.com/advisories/SK-2025-001"
    }
  ]
}
```

#### Deprecation in Frontmatter

```yaml
---
name: old-deploy-skill
version: 2.1.0
deprecated: true
deprecatedMessage: "Use new-deploy-skill instead. Sunset: 2025-12-31"
---
```

**Tasks**:
- [ ] Create `packages/cli/src/revocation/index.ts` with `readRevocationList()`, `checkRevocations()`
- [ ] Define `RevocationList`, `RevocationEntry` types in schema
- [ ] Scanner: parse `deprecated` and `deprecatedMessage` from SKILL.md frontmatter
- [ ] `checkRevocations()`: match skill names against revocation list, return matches with severity
- [ ] Wire into `audit` command: check revocations as part of audit pipeline
- [ ] Wire into `health` command: add `--check-revocations` flag (path to revocation file)
- [ ] Deprecation: when scanner finds `deprecated: true`, populate `FingerprintEntry.status = 'deprecated'`
- [ ] Deprecation warnings in `lint` output (separate from errors)
- [ ] Unit tests: revocation matching, missing file handling, severity levels
- [ ] Unit tests: deprecated frontmatter parsing, status propagation
- [ ] Integration test: revoked skill → audit fails with critical finding

**Acceptance**: Revoked skills cause audit failure. Deprecated skills emit warnings. Revocation list is read from local file path.

---

## Wave 4: Coverage Sweep (after all waves)

Final pass to ensure all new Phase 1 code has adequate test coverage.

**Tasks**:
- [ ] Run `pnpm vitest --coverage` and identify any Phase 1 code below 80% line coverage
- [ ] Add missing tests for edge cases found during coverage analysis
- [ ] Verify all new reporters handle the new fields (exemptions, integrity, revocations)
- [ ] Run `pnpm run typecheck` — zero type errors
- [ ] Run `pnpm run build` — clean build
- [ ] Run `pnpm run lint` — no new warnings
- [ ] Run full test suite: `pnpm test` — all green
- [ ] Manual smoke test: run `skills-check health --frozen-lockfile` against real skills directory

**Acceptance**: Build green. Tests green. No type errors. Coverage >= 80% on all new code.

---

## Dependency Graph

```
Wave 1A (Schema) ─────┬──── Wave 1B (Lock File) ──── Wave 2 (Tamper Detection)
                       │
                       ├──── Wave 1C (Exemptions) ───┐
                       │                              ├── Wave 3 (Revocation)
                       └──── Wave 1D (Test Gaps)      │
                                                      │
                                              Wave 4 (Coverage Sweep)
```

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Lock file format churn | Define v2 schema once in Wave 1A, freeze it. No mid-phase schema changes. |
| Exemption glob matching adds dependency | Check if `picomatch` or `minimatch` is already in the dep tree (Commander/Vitest may bring one). Prefer existing. |
| Breaking existing `skills-lock.json` consumers | `migrateLockFileV1()` handles upgrade. Old format auto-detected by missing `lockfileVersion` field. |
| SARIF suppressions spec compliance | Validate against official SARIF 2.1.0 JSON Schema in reporter tests. |
| skills-trace type divergence | After Wave 1A, open GitHub issue on skills-trace to consume `@skills-check/schema` directly. |
| E2E test flakiness (file I/O, timing) | Use Vitest `beforeAll`/`afterAll` with temp directories. No shared state between tests. |

## Estimated Effort

| Wave | Effort | Parallelizable |
|------|--------|----------------|
| 1A (Schema) | 0.5 day | No (blocks all) |
| 1B (Lock File) | 2-3 days | Yes (after 1A) |
| 1C (Exemptions) | 2-3 days | Yes (after 1A, parallel with 1B) |
| 1D (Test Gaps) | 1-2 days | Yes (after 1A, parallel with 1B/1C) |
| 2 (Tamper) | 1-2 days | No (after 1B) |
| 3 (Revocation) | 2 days | No (after 1A + 1C) |
| 4 (Coverage) | 0.5 day | No (after all) |
| **Total** | **~10-13 days** | 1B/1C/1D run in parallel |

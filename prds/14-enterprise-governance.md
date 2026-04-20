# PRD 14: Enterprise Governance — Policy Packs, Signed Fingerprints, and Drift Bot

## Status
RFC — seeking feedback

## Problem Statement
skills-check currently operates as a local CLI tool. Organizations using Agent Skills at scale need:
1. Reusable policy configurations that can be shared across teams
2. Cryptographic verification that skills haven't been tampered with
3. Automated monitoring for drift (stale versions, broken links, policy regressions)

## Proposed Areas

### 1. Reusable Policy Packs
**What:** Named, versioned collections of `.skill-policy.yml` configurations that organizations can publish and share.

**MVP scope:**
- Policy pack format: a directory or npm package containing one or more `.skill-policy.yml` files
- `skills-check policy --pack <name>` loads rules from an installed pack
- Packs can extend/override each other (cascading)
- Built-in pack: `@skills-check/policy-recommended` with sensible defaults

**Implementation tickets:**
- [ ] Define policy pack format and resolution strategy
- [ ] Implement `--pack` flag in policy command
- [ ] Create `@skills-check/policy-recommended` pack
- [ ] Add pack documentation

### 2. Signed Fingerprints
**What:** Cryptographic signatures on fingerprint registry output so consumers can verify skill integrity.

**MVP scope:**
- `skills-check fingerprint --sign` generates a detached signature using a configured key
- `skills-check fingerprint --verify` checks signatures against a trust store
- Support for Ed25519 keys (Node.js crypto built-in)
- Signature format: JSON with base64-encoded signature + public key reference

**Implementation tickets:**
- [ ] Define signed fingerprint schema
- [ ] Implement `--sign` flag with Ed25519 key support
- [ ] Implement `--verify` flag with trust store
- [ ] Key management documentation
- [ ] Integration with `policy` for mandatory signing rules

### 3. Drift Bot Automation
**What:** Scheduled monitoring that detects and reports on skill drift without manual CLI runs.

**MVP scope:**
- GitHub Action workflow template for scheduled drift checks
- `skills-check drift` command that combines `check` + `audit` + `policy` and generates a single report
- Configurable alerting: GitHub issues, webhook, or markdown report
- Diff against previous run (stored as JSON artifact)

**Implementation tickets:**
- [ ] Create `drift` command combining check+audit+policy
- [ ] Create reusable GitHub Action workflow template
- [ ] Implement diff-against-previous reporting
- [ ] Add webhook/notification support
- [ ] Documentation and examples

## Architecture Considerations

### Policy Pack Resolution
```
1. Local .skill-policy.yml (highest priority)
2. --pack flag packs (in order specified)
3. Inherited from parent directory walk
4. @skills-check/policy-recommended (lowest, if installed)
```

### Signed Fingerprint Schema
```json
{
  "registry": { ... },
  "signature": {
    "algorithm": "ed25519",
    "publicKeyId": "org-key-2024",
    "value": "base64...",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### Drift Detection Flow
```
Scheduled trigger (cron/webhook)
  → Run check, audit, policy
  → Compare against stored baseline
  → Generate diff report
  → Notify via configured channel
```

## Dependencies
- Policy packs depend on the existing `policy` command infrastructure
- Signed fingerprints depend on the existing `fingerprint` command
- Drift bot depends on `check`, `audit`, and `policy` commands

## Success Metrics
- At least one enterprise team adopts policy packs within 3 months
- Signed fingerprints used in at least one CI pipeline
- Drift bot catches at least one real regression in production

## Open Questions
1. Should policy packs be npm packages or a custom format?
2. Should signed fingerprints use OIDC/Sigstore for keyless signing in CI?
3. Should the drift bot be a separate package or part of the CLI?

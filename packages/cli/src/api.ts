/**
 * Programmatic API for skills-check.
 *
 * Provides importable functions for IDE integrations,
 * custom dashboards, and monorepo tooling.
 *
 * @example
 * ```ts
 * import { runAudit, runLint, runBudget } from "skills-check/api";
 *
 * const auditReport = await runAudit(["./skills"]);
 * const lintReport = await runLint(["./skills"]);
 * const budgetReport = await runBudget(["./skills"]);
 * ```
 */

// biome-ignore lint/performance/noBarrelFile: intentional public API entry point
export { runAudit } from "./audit/index.js";
// Types
export type { AuditFinding, AuditOptions, AuditReport } from "./audit/types.js";
export { runBudget } from "./budget/index.js";
export type { BudgetOptions, BudgetReport } from "./budget/types.js";
export { runLint } from "./lint/index.js";
export type { LintFinding, LintOptions, LintReport } from "./lint/types.js";
export { runPolicyCheck } from "./policy/index.js";
export type { PolicyReport, SkillPolicy } from "./policy/types.js";
export type { SkillsCheckConfig } from "./shared/config.js";
// Shared utilities
export { loadConfig } from "./shared/config.js";
export { discoverSkillFiles } from "./shared/discovery.js";
export type { Progress } from "./shared/progress.js";
export { createProgress } from "./shared/progress.js";
export { runTests } from "./testing/index.js";
export type { TestOptions, TestReport } from "./testing/types.js";
export { runVerify } from "./verify/index.js";
export type { VerifyOptions, VerifyReport, VerifyResult } from "./verify/types.js";

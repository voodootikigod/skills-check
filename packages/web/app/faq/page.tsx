import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import styles from "./faq.module.css";

export const metadata: Metadata = {
	title: "FAQ — skills-check",
	description:
		"Frequently asked questions about skills-check, Agent Skills, SKILL.md files, security auditing, version drift detection, token budgets, and CI/CD integration.",
	alternates: {
		canonical: "https://skillscheck.ai/faq",
	},
};

const faqItems = [
	{
		category: "General",
		questions: [
			{
				q: "What is an Agent Skill?",
				a: "An Agent Skill is a markdown document (SKILL.md) with YAML frontmatter that instructs AI coding agents — such as Claude Code, Cursor, and Codex — how to work with specific products, frameworks, and patterns. Skills look like documentation but are treated as executable instructions by agents with file system and shell access.",
			},
			{
				q: "What is a SKILL.md file?",
				a: "A SKILL.md file is the standard format for Agent Skills, defined by the Agent Skills spec. It contains YAML frontmatter with metadata (name, description, product-version) followed by markdown content that teaches an AI agent how to use a particular technology correctly and safely.",
			},
			{
				q: "What is skills-check?",
				a: "skills-check is the quality and integrity layer for Agent Skills. It answers whether your skills are correct, safe, current, and efficient by providing commands for freshness detection, security auditing, metadata linting, token budget analysis, semver verification, policy enforcement, and eval testing.",
			},
			{
				q: "How is skills-check different from linters or security scanners?",
				a: (
					<>
						Traditional linters check code syntax and style, while security scanners look for
						vulnerabilities in dependencies. skills-check is purpose-built for SKILL.md files — it
						detects{" "}
						<Link href="/commands/audit">hallucinated packages, prompt injection patterns</Link>,
						version drift against live registries, and measures the token cost of loading skills
						into an agent&apos;s context window.
					</>
				),
			},
		],
	},
	{
		category: "Freshness",
		questions: [
			{
				q: "How do I check if my AI agent skills are up to date?",
				a: (
					<>
						Run <code>npx skills-check check</code> to compare the <code>product-version</code> in
						each skill&apos;s frontmatter against the latest version on npm. The{" "}
						<Link href="/commands/check">check command</Link> reports which skills have drifted and
						by how many versions, with <code>--ci</code> mode for pipeline integration.
					</>
				),
			},
			{
				q: "How do I automatically update stale agent skills?",
				a: (
					<>
						The <Link href="/commands/refresh">refresh command</Link> uses an LLM to propose
						targeted updates to stale skill files. Run <code>npx skills-check refresh</code> to
						fetch changelogs, generate diffs, and optionally apply changes. It supports Anthropic,
						OpenAI, and Google providers.
					</>
				),
			},
			{
				q: "What is product-version drift in agent skills?",
				a: (
					<>
						Product-version drift occurs when the <code>product-version</code> field in a
						skill&apos;s frontmatter falls behind the latest release on npm. This means the skill
						may contain outdated instructions, deprecated APIs, or missing features. The{" "}
						<Link href="/commands/check">check command</Link> detects this automatically.
					</>
				),
			},
		],
	},
	{
		category: "Security",
		questions: [
			{
				q: "How do I audit SKILL.md files for security issues?",
				a: (
					<>
						Run <code>npx skills-check audit</code> to scan your skill files. The{" "}
						<Link href="/commands/audit">audit command</Link> checks for hallucinated packages that
						don&apos;t exist on registries, prompt injection patterns, dangerous shell commands,
						dead URLs, and metadata gaps. Output formats include terminal, JSON, Markdown, and SARIF
						for GitHub Security integration.
					</>
				),
			},
			{
				q: "How do I detect hallucinated packages in agent skills?",
				a: (
					<>
						The <Link href="/commands/audit">audit command</Link> extracts every package reference
						from your skill files and verifies each one exists on npm, PyPI, or crates.io. It also
						cross-references against a database of known hallucinated packages identified by
						security researchers. Run <code>npx skills-check audit</code> to check your skills.
					</>
				),
			},
			{
				q: "What is prompt injection in agent skills?",
				a: (
					<>
						Prompt injection in agent skills occurs when a SKILL.md file contains instructions that
						attempt to override the agent&apos;s behavior — such as ignoring previous instructions,
						exfiltrating data, or executing obfuscated commands. The{" "}
						<Link href="/commands/audit">audit command</Link> scans for these patterns as part of
						its security checks.
					</>
				),
			},
		],
	},
	{
		category: "Quality",
		questions: [
			{
				q: "How do I lint SKILL.md files?",
				a: (
					<>
						Run <code>npx skills-check lint</code> to validate metadata completeness and format. The{" "}
						<Link href="/commands/lint">lint command</Link> checks for required frontmatter fields,
						structural quality, SPDX license identifiers, and semver formatting. Use{" "}
						<code>--fix</code> to auto-populate missing fields from git context.
					</>
				),
			},
			{
				q: "How do I measure the token cost of agent skills?",
				a: (
					<>
						The <Link href="/commands/budget">budget command</Link> counts tokens using the
						cl100k_base encoding, shows per-skill and per-section breakdowns, detects redundancy
						between skills via n-gram similarity, and estimates costs across model pricing tiers.
						Run <code>npx skills-check budget</code> to analyze your skills.
					</>
				),
			},
			{
				q: "How do I verify semver bumps for agent skills?",
				a: (
					<>
						Run <code>npx skills-check verify</code> to validate that content changes between skill
						versions match the declared semver bump. The{" "}
						<Link href="/commands/verify">verify command</Link> uses heuristic rules and optionally
						LLM-assisted semantic analysis to detect dishonest or accidental version changes.
					</>
				),
			},
		],
	},
	{
		category: "CI/CD",
		questions: [
			{
				q: "How do I enforce skill quality in CI/CD?",
				a: (
					<>
						Every skills-check command supports <code>--ci</code> mode for strict exit codes and{" "}
						<code>--fail-on</code> for configurable severity thresholds. Combine multiple commands
						in a pipeline — for example, run <Link href="/commands/audit">audit</Link>,{" "}
						<Link href="/commands/lint">lint</Link>, and <Link href="/commands/budget">budget</Link>{" "}
						together to gate pull requests on security, metadata quality, and token cost.
					</>
				),
			},
			{
				q: "How do I use skills-check as a GitHub Action?",
				a: (
					<>
						Add <code>uses: voodootikigod/skills-check@v1</code> to your workflow. The action
						supports all 10 commands via the <code>commands</code> input (e.g.,{" "}
						<code>commands: check,audit,lint,budget</code>) with per-command threshold inputs like{" "}
						<code>audit-fail-on</code> and <code>budget-max-tokens</code>. See the{" "}
						<Link href="/docs#ci">CI integration docs</Link> for full configuration.
					</>
				),
			},
			{
				q: "How do I set up policy enforcement for agent skills?",
				a: (
					<>
						Create a <code>.skill-policy.yml</code> file to define organizational rules — trusted
						sources, banned patterns, required metadata, and staleness limits. Then run{" "}
						<code>npx skills-check policy check</code> to enforce them. The{" "}
						<Link href="/commands/policy">policy command</Link> supports CI mode and integrates with
						the audit command for comprehensive enforcement.
					</>
				),
			},
		],
	},
];

// Plain text answers for JSON-LD (no JSX)
const jsonLdAnswers: Record<string, string> = {
	"What is an Agent Skill?":
		"An Agent Skill is a markdown document (SKILL.md) with YAML frontmatter that instructs AI coding agents — such as Claude Code, Cursor, and Codex — how to work with specific products, frameworks, and patterns. Skills look like documentation but are treated as executable instructions by agents with file system and shell access.",
	"What is a SKILL.md file?":
		"A SKILL.md file is the standard format for Agent Skills, defined by the Agent Skills spec. It contains YAML frontmatter with metadata (name, description, product-version) followed by markdown content that teaches an AI agent how to use a particular technology correctly and safely.",
	"What is skills-check?":
		"skills-check is the quality and integrity layer for Agent Skills. It answers whether your skills are correct, safe, current, and efficient by providing commands for freshness detection, security auditing, metadata linting, token budget analysis, semver verification, policy enforcement, and eval testing.",
	"How is skills-check different from linters or security scanners?":
		"Traditional linters check code syntax and style, while security scanners look for vulnerabilities in dependencies. skills-check is purpose-built for SKILL.md files — it detects hallucinated packages, prompt injection patterns, version drift against live registries, and measures the token cost of loading skills into an agent's context window.",
	"How do I check if my AI agent skills are up to date?":
		"Run npx skills-check check to compare the product-version in each skill's frontmatter against the latest version on npm. The check command reports which skills have drifted and by how many versions, with --ci mode for pipeline integration.",
	"How do I automatically update stale agent skills?":
		"The refresh command uses an LLM to propose targeted updates to stale skill files. Run npx skills-check refresh to fetch changelogs, generate diffs, and optionally apply changes. It supports Anthropic, OpenAI, and Google providers.",
	"What is product-version drift in agent skills?":
		"Product-version drift occurs when the product-version field in a skill's frontmatter falls behind the latest release on npm. This means the skill may contain outdated instructions, deprecated APIs, or missing features. The check command detects this automatically.",
	"How do I audit SKILL.md files for security issues?":
		"Run npx skills-check audit to scan your skill files. The audit command checks for hallucinated packages that don't exist on registries, prompt injection patterns, dangerous shell commands, dead URLs, and metadata gaps. Output formats include terminal, JSON, Markdown, and SARIF for GitHub Security integration.",
	"How do I detect hallucinated packages in agent skills?":
		"The audit command extracts every package reference from your skill files and verifies each one exists on npm, PyPI, or crates.io. It also cross-references against a database of known hallucinated packages identified by security researchers. Run npx skills-check audit to check your skills.",
	"What is prompt injection in agent skills?":
		"Prompt injection in agent skills occurs when a SKILL.md file contains instructions that attempt to override the agent's behavior — such as ignoring previous instructions, exfiltrating data, or executing obfuscated commands. The audit command scans for these patterns as part of its security checks.",
	"How do I lint SKILL.md files?":
		"Run npx skills-check lint to validate metadata completeness and format. The lint command checks for required frontmatter fields, structural quality, SPDX license identifiers, and semver formatting. Use --fix to auto-populate missing fields from git context.",
	"How do I measure the token cost of agent skills?":
		"The budget command counts tokens using the cl100k_base encoding, shows per-skill and per-section breakdowns, detects redundancy between skills via n-gram similarity, and estimates costs across model pricing tiers. Run npx skills-check budget to analyze your skills.",
	"How do I verify semver bumps for agent skills?":
		"Run npx skills-check verify to validate that content changes between skill versions match the declared semver bump. The verify command uses heuristic rules and optionally LLM-assisted semantic analysis to detect dishonest or accidental version changes.",
	"How do I enforce skill quality in CI/CD?":
		"Every skills-check command supports --ci mode for strict exit codes and --fail-on for configurable severity thresholds. Combine multiple commands in a pipeline — for example, run audit, lint, and budget together to gate pull requests on security, metadata quality, and token cost.",
	"How do I use skills-check as a GitHub Action?":
		"Add uses: voodootikigod/skills-check@v1 to your workflow. The action supports all 10 commands via the commands input (e.g., commands: check,audit,lint,budget) with per-command threshold inputs like audit-fail-on and budget-max-tokens. See the CI integration docs for full configuration.",
	"How do I set up policy enforcement for agent skills?":
		"Create a .skill-policy.yml file to define organizational rules — trusted sources, banned patterns, required metadata, and staleness limits. Then run npx skills-check policy check to enforce them. The policy command supports CI mode and integrates with the audit command for comprehensive enforcement.",
};

function buildJsonLd() {
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: faqItems.flatMap((category) =>
			category.questions.map((item) => ({
				"@type": "Question",
				name: item.q,
				acceptedAnswer: {
					"@type": "Answer",
					text: jsonLdAnswers[item.q] ?? "",
				},
			}))
		),
	};
}

export default function FaqPage() {
	const structuredData = buildJsonLd();

	return (
		<>
			<script
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires innerHTML
				dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
				type="application/ld+json"
			/>
			<Header />
			<main className={styles.main}>
				<article className={styles.article}>
					<h1>Frequently Asked Questions</h1>
					<p className={styles.subtitle}>
						Common questions about skills-check, Agent Skills, and keeping your SKILL.md files
						correct, safe, and efficient.
					</p>

					{faqItems.map((category) => (
						<section className={styles.category} key={category.category}>
							<h2 className={styles.categoryTitle}>{category.category}</h2>
							{category.questions.map((item) => (
								<div className={styles.question} key={item.q}>
									<h3>{item.q}</h3>
									<p>{item.a}</p>
								</div>
							))}
						</section>
					))}
				</article>
			</main>
			<Footer />
		</>
	);
}

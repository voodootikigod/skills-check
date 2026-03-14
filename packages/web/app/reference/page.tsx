import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import styles from "./reference.module.css";

export const metadata: Metadata = {
	title: "Programmatic Reference",
	description:
		"Exit codes, JSON output schemas, scripting examples, and SARIF integration for skills-check. Everything you need to use skills-check output programmatically in CI pipelines and scripts.",
	alternates: {
		canonical: "https://skillscheck.ai/reference",
	},
};

const techArticleJsonLd = {
	"@context": "https://schema.org",
	"@type": "TechArticle",
	headline: "Programmatic Reference | Skills Check",
	description:
		"Exit codes, JSON output schemas, scripting examples, and SARIF integration for skills-check. Everything you need to use skills-check output programmatically.",
	url: "https://skillscheck.ai/reference",
	author: { "@type": "Person", name: "Chris Williams" },
};

export default function ReferencePage() {
	return (
		<>
			<script
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires innerHTML
				dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleJsonLd) }}
				type="application/ld+json"
			/>
			<Header />
			<main className={styles.main}>
				<article className={styles.article}>
					<h1>Programmatic Reference</h1>
					<p>
						Every skills-check command supports <code>--json</code> for machine-readable output and{" "}
						<code>--ci</code> for strict exit codes. This page documents the exit code conventions,
						JSON output shapes, and practical scripting patterns for integrating skills-check into
						your CI pipelines and automation.
					</p>

					<section>
						<h2 id="exit-codes">Exit Codes</h2>
						<p>
							All commands follow a consistent exit code convention. Use these in CI to gate
							deployments, fail PR checks, or trigger downstream workflows.
						</p>
						<table>
							<thead>
								<tr>
									<th>Code</th>
									<th>Meaning</th>
									<th>When It Happens</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td>
										<code>0</code>
									</td>
									<td>Success</td>
									<td>No findings, all checks pass</td>
								</tr>
								<tr>
									<td>
										<code>1</code>
									</td>
									<td>Findings detected</td>
									<td>
										Findings above the configured threshold (<code>--fail-on</code> severity)
									</td>
								</tr>
								<tr>
									<td>
										<code>2</code>
									</td>
									<td>Configuration error</td>
									<td>Invalid registry, missing required files, bad options</td>
								</tr>
							</tbody>
						</table>
						<p>
							Use <code>--fail-on &lt;severity&gt;</code> to control the threshold that triggers
							exit code 1. For example, <code>--fail-on medium</code> exits 1 only when medium or
							higher severity findings are present.
						</p>
					</section>

					<section>
						<h2 id="json-schemas">JSON Output Schemas</h2>
						<p>
							Pass <code>--json</code> (or <code>--format json</code>) to any command to get
							structured output. Below are the shapes for key commands.
						</p>

						<h3 id="json-check">
							<code>check --json</code>
						</h3>
						<pre>
							<code>
								{`{
  "results": [
    {
      "file": "SKILL.md",
      "product": "react",
      "currentVersion": "18.2.0",
      "latestVersion": "19.1.0",
      "status": "stale"
    }
  ]
}`}
							</code>
						</pre>

						<h3 id="json-audit">
							<code>audit --format json</code>
						</h3>
						<pre>
							<code>
								{`{
  "findings": [
    {
      "file": "SKILL.md",
      "checker": "registry",
      "severity": "critical",
      "message": "Package 'react-utils-pro' not found on npm",
      "line": 42
    }
  ],
  "summary": { "critical": 1, "high": 0, "medium": 2, "low": 0 }
}`}
							</code>
						</pre>

						<h3 id="json-budget">
							<code>budget --format json</code>
						</h3>
						<pre>
							<code>
								{`{
  "skills": [
    {
      "file": "SKILL.md",
      "tokens": 2450,
      "sections": [{ "heading": "Installation", "tokens": 320 }]
    }
  ],
  "redundancy": [
    { "fileA": "a.md", "fileB": "b.md", "similarity": 0.73 }
  ]
}`}
							</code>
						</pre>

						<h3 id="json-lint">
							<code>lint --format json</code>
						</h3>
						<pre>
							<code>
								{`{
  "findings": [
    {
      "file": "SKILL.md",
      "rule": "required-field",
      "severity": "error",
      "field": "compatibility",
      "message": "Missing required field: compatibility (or product-version)"
    }
  ]
}`}
							</code>
						</pre>
					</section>

					<section>
						<h2 id="scripting">Scripting Examples</h2>
						<p>
							Combine <code>--json</code> output with <code>jq</code> for powerful CI integrations.
						</p>

						<h4>Fail CI if any critical audit findings</h4>
						<pre>
							<code>{`npx skills-check audit --json | jq -e '.summary.critical == 0'`}</code>
						</pre>

						<h4>Get list of stale skills</h4>
						<pre>
							<code>
								{`npx skills-check check --json | jq -r '.results[] | select(.status == "stale") | .file'`}
							</code>
						</pre>

						<h4>Budget report as markdown for PR comment</h4>
						<pre>
							<code>{"npx skills-check budget --reporter markdown > budget-report.md"}</code>
						</pre>

						<h4>Enforce max token budget per skill</h4>
						<pre>
							<code>{"npx skills-check budget --max-tokens 5000 --ci"}</code>
						</pre>

						<h4>Run audit with SARIF output for GitHub Security tab</h4>
						<pre>
							<code>{"npx skills-check audit --reporter sarif > results.sarif"}</code>
						</pre>
					</section>

					<section>
						<h2 id="sarif">SARIF Integration</h2>
						<p>
							The <code>audit</code> command supports{" "}
							<a
								href="https://sarifweb.azurewebsites.net/"
								rel="noopener noreferrer"
								target="_blank"
							>
								SARIF 2.1.0
							</a>{" "}
							output, which integrates directly with GitHub Code Scanning and the Security tab.
							Upload SARIF results to see audit findings as code annotations in pull requests and
							track them alongside other security tools.
						</p>

						<h4>GitHub Action workflow</h4>
						<pre>
							<code>
								{`- uses: voodootikigod/skills-check@v1
  with:
    commands: audit
    audit-reporter: sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: skills-check-audit.sarif`}
							</code>
						</pre>
						<p>
							This uploads hallucinated package detections, prompt injection warnings, and other
							audit findings to the GitHub Security tab where they appear alongside CodeQL and other
							SARIF-compatible scanners.
						</p>
					</section>

					<section>
						<h2 id="further-reading">Further Reading</h2>
						<p>
							See the <Link href="/docs">full documentation</Link> for command reference, registry
							format, and CI integration details. For individual command options, visit the{" "}
							<Link href="/commands/audit">audit</Link>, <Link href="/commands/budget">budget</Link>
							, <Link href="/commands/lint">lint</Link>, and{" "}
							<Link href="/commands/check">check</Link> command pages.
						</p>
					</section>
				</article>
			</main>
			<Footer />
		</>
	);
}

import styles from "./explainer.module.css";

export function Explainer() {
	return (
		<section className={styles.section}>
			<div className={styles.container}>
				<h2 className={styles.heading}>What is an Agent Skill?</h2>
				<p className={styles.lead}>
					Agent Skills are the knowledge layer between AI coding agents and the tools they use.
				</p>
				<div className={styles.content}>
					<div className={styles.prose}>
						<p className={styles.paragraph}>
							<strong>Skills are SKILL.md files</strong> &mdash; markdown documents with YAML
							frontmatter that instruct AI coding agents like Claude Code, Cursor, and Codex how to
							work with specific products, frameworks, and patterns. They look like documentation,
							but they&rsquo;re treated as executable instructions.
						</p>
						<p className={styles.paragraph}>
							Skills are loaded directly into an agent&rsquo;s <strong>LLM context window</strong>,
							where they shape every decision the agent makes. A skill telling an agent to use a
							deprecated API or a nonexistent package isn&rsquo;t just inaccurate &mdash; it
							produces broken code.
						</p>
						<p className={styles.paragraph}>
							Because agents have <strong>file system and shell access</strong>, skill quality is a
							security and correctness concern, not just a readability one. A skill suggesting{" "}
							<code>rm -rf</code> or referencing a typosquatted package poses real risk.
						</p>
						<p className={styles.paragraph}>
							The ecosystem splits responsibilities:{" "}
							<span className={styles.accent}>skills.sh</span> handles installation and
							distribution, while <span className={styles.accent}>skills-check</span> handles
							verification and quality &mdash; freshness, security, linting, token budgets, semver
							accuracy, policy enforcement, and testing.
						</p>
					</div>
					<div className={styles.example}>
						<div className={styles.exampleLabel}>Example SKILL.md frontmatter</div>
						<code className={styles.exampleCode}>
							<span className={styles.yamlDelimiter}>---</span>
							{"\n"}
							<span className={styles.yamlKey}>name</span>
							<span className={styles.yamlDelimiter}>: </span>
							<span className={styles.yamlValue}>react</span>
							{"\n"}
							<span className={styles.yamlKey}>description</span>
							<span className={styles.yamlDelimiter}>: </span>
							<span className={styles.yamlValue}>Modern React patterns and best practices</span>
							{"\n"}
							<span className={styles.yamlKey}>version</span>
							<span className={styles.yamlDelimiter}>: </span>
							<span className={styles.yamlValue}>1.2.0</span>
							{"\n"}
							<span className={styles.yamlKey}>compatibility</span>
							<span className={styles.yamlDelimiter}>: </span>
							<span className={styles.yamlValue}>&quot;react@^19.1.0&quot;</span>
							{"\n"}
							<span className={styles.yamlKey}>author</span>
							<span className={styles.yamlDelimiter}>: </span>
							<span className={styles.yamlValue}>skills-community</span>
							{"\n"}
							<span className={styles.yamlDelimiter}>---</span>
						</code>
					</div>
				</div>
			</div>
		</section>
	);
}

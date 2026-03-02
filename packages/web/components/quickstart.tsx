import { CopyButton } from "./copy-button";
import styles from "./quickstart.module.css";

const steps = [
	{
		number: "1",
		title: "Scan your skills directory",
		description: "Discover SKILL.md files and map them to npm packages.",
		command: "npx skill-versions init",
	},
	{
		number: "2",
		title: "Check for staleness",
		description: "Compare verified versions against the npm registry.",
		command: "npx skill-versions check",
	},
	{
		number: "3",
		title: "Generate a report",
		description: "Get a full markdown report for your team or CI pipeline.",
		command: "npx skill-versions report",
	},
	{
		number: "4",
		title: "AI-assisted refresh",
		description: "Use an LLM to propose targeted updates to stale skill files.",
		command: "npx skill-versions refresh",
	},
];

export function Quickstart() {
	return (
		<section className={styles.section}>
			<div className={styles.container}>
				<h2 className={styles.heading}>Quickstart</h2>
				<p className={styles.subtitle}>Four commands to keep your agent skills fresh.</p>
				<div className={styles.steps}>
					{steps.map((step) => (
						<div key={step.number} className={styles.step}>
							<div className={styles.stepNumber}>{step.number}</div>
							<div className={styles.stepContent}>
								<h3 className={styles.stepTitle}>{step.title}</h3>
								<p className={styles.stepDescription}>{step.description}</p>
								<div className={styles.codeBlock}>
									<code>{step.command}</code>
									<CopyButton text={step.command} />
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

import { Commands } from "@/components/commands";
import { Footer } from "@/components/footer";
import { GitHubAction } from "@/components/github-action";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Problem } from "@/components/problem";
import { Quickstart } from "@/components/quickstart";

const jsonLd = {
	"@context": "https://schema.org",
	"@type": "SoftwareApplication",
	name: "skills-check",
	applicationCategory: "DeveloperApplication",
	operatingSystem: "Any",
	description:
		"Quality & integrity layer for AI Agent Skills — check freshness, audit security, lint metadata, enforce policy, measure token budgets, verify semver, and run eval tests across your SKILL.md files.",
	url: "https://skillscheck.ai",
	downloadUrl: "https://www.npmjs.com/package/skills-check",
	softwareVersion: "1.3.0",
	author: {
		"@type": "Person",
		name: "Chris Williams",
		url: "https://github.com/voodootikigod",
	},
	offers: {
		"@type": "Offer",
		price: "0",
		priceCurrency: "USD",
	},
};

const howToJsonLd = {
	"@context": "https://schema.org",
	"@type": "HowTo",
	name: "How to set up skills-check for your AI agent skills",
	description: "Five steps to keep your agent skills fresh, safe, and efficient.",
	step: [
		{
			"@type": "HowToStep",
			position: 1,
			name: "Initialize your registry",
			text: "Discover SKILL.md files and map them to npm packages.",
			url: "https://skillscheck.ai/#quickstart",
		},
		{
			"@type": "HowToStep",
			position: 2,
			name: "Check freshness and audit safety",
			text: "Detect version drift and scan for security issues in one pass.",
			url: "https://skillscheck.ai/#quickstart",
		},
		{
			"@type": "HowToStep",
			position: 3,
			name: "Lint, budget, and verify",
			text: "Validate metadata, measure token costs, and confirm version bumps are honest.",
			url: "https://skillscheck.ai/#quickstart",
		},
		{
			"@type": "HowToStep",
			position: 4,
			name: "Enforce policy and test",
			text: "Apply organizational trust rules and run eval test suites.",
			url: "https://skillscheck.ai/#quickstart",
		},
		{
			"@type": "HowToStep",
			position: 5,
			name: "Refresh stale skills",
			text: "Use an LLM to propose targeted updates and generate a report.",
			url: "https://skillscheck.ai/#quickstart",
		},
	],
};

const organizationJsonLd = {
	"@context": "https://schema.org",
	"@type": "Organization",
	name: "Skills Check",
	url: "https://skillscheck.ai",
	logo: "https://skillscheck.ai/icon.svg",
	sameAs: ["https://github.com/voodootikigod/skills-check"],
};

export default function Home() {
	return (
		<>
			<script
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires innerHTML
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
				type="application/ld+json"
			/>
			<script
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires innerHTML
				dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
				type="application/ld+json"
			/>
			<script
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires innerHTML
				dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
				type="application/ld+json"
			/>
			<Header />
			<main>
				<Hero />
				<Problem />
				<Commands />
				<GitHubAction />
				<Quickstart />
			</main>
			<Footer />
		</>
	);
}

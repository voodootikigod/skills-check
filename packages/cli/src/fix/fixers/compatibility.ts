import matter from "gray-matter";
import type { SkillFile } from "../../skill-io.js";
import type { FixResult } from "../types.js";

/**
 * Migrate `product-version` to `compatibility` if the skill has `product-version`
 * but no `compatibility` field.
 *
 * Converts "product-version: 15.0.0" with a product name to "compatibility: product@15.0.0".
 */
export function fixCompatibility(file: SkillFile): {
	content: string;
	fixes: FixResult[];
} | null {
	const fm = { ...file.frontmatter };

	// Only migrate if product-version exists and compatibility does not
	if (!fm["product-version"] || fm.compatibility) {
		return null;
	}

	const productVersion = String(fm["product-version"]);
	const productName = fm.name ? String(fm.name) : null;

	// Build compatibility string
	let compatValue: string;
	if (productName) {
		compatValue = `${productName}@${productVersion}`;
	} else {
		compatValue = productVersion;
	}

	// Build new frontmatter without product-version, with compatibility added
	const { "product-version": _, ...rest } = fm;
	const newFm = { ...rest, compatibility: compatValue };

	const content = matter.stringify(file.content, newFm);
	return {
		content,
		fixes: [
			{
				fixer: "compatibility",
				description: `Migrated product-version "${productVersion}" to compatibility "${compatValue}"`,
			},
		],
	};
}

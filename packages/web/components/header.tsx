import Link from "next/link";
import styles from "./header.module.css";

export function Header() {
	return (
		<header className={styles.header}>
			<nav className={styles.nav}>
				<Link href="/" className={styles.logo}>
					skill-versions
				</Link>
				<div className={styles.links}>
					<Link href="/docs">Docs</Link>
					<a
						href="https://github.com/voodootikigod/skill-versions"
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub
					</a>
				</div>
			</nav>
		</header>
	);
}

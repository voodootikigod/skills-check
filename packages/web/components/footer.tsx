import Image from "next/image";
import Link from "next/link";
import styles from "./footer.module.css";

export function Footer() {
	return (
		<footer className={styles.footer}>
			<div className={styles.container}>
				<div className={styles.left}>
					<span className={styles.brand}>skill-versions</span>
					<span className={styles.separator}>|</span>
					<a
						href="https://github.com/voodootikigod/skill-versions"
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub
					</a>
					<Link href="/docs">Docs</Link>
					<Link href="/schema.json">Schema</Link>
				</div>
				<div className={styles.right}>
					<a
						href="https://npmjs.com/package/skill-versions"
						target="_blank"
						rel="noopener noreferrer"
					>
						npm
					</a>
				</div>
			</div>
			<div className={styles.author}>
				<span className={styles.authorText}>Made with love from</span>
				<a
					href="https://github.com/voodootikigod"
					target="_blank"
					rel="noopener noreferrer"
					className={styles.authorLink}
				>
					<Image
						src="/voodootikigod.webp"
						alt="@voodootikigod"
						width={20}
						height={20}
						className={styles.avatar}
					/>
					@voodootikigod
				</a>
			</div>
		</footer>
	);
}

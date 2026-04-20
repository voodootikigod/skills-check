# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in skills-check, please report it responsibly:

1. **Do NOT open a public GitHub issue** for security vulnerabilities
2. Email security reports to voodootikigod@gmail.com
3. Include a description of the vulnerability, steps to reproduce, and potential impact
4. You will receive a response within 72 hours

We follow coordinated disclosure. We will work with you to understand the issue and develop a fix before any public disclosure.

## Scope

The following are in scope for security reports:
- Command injection or code execution vulnerabilities
- Supply chain risks in the CLI or GitHub Action
- Prompt injection vulnerabilities in LLM-assisted commands
- Authentication/authorization bypasses
- Dependency vulnerabilities

## Security Practices

- CI/CD actions are SHA-pinned (Dependabot keeps pins current)
- Dependencies are monitored by Dependabot
- CodeQL static analysis runs on pull requests
- The CLI pins its own version in the GitHub Action

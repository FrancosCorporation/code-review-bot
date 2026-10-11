# Security

## Report a vulnerability

Please report vulnerabilities privately through [GitHub Security Advisories](https://github.com/FrancosCorporation/code-review-bot/security/advisories/new). Include the affected version, impact, and reproduction steps. Do not include a live token or LLM API key in the report.

## Security boundaries

- Configure only `contents: read` and `pull-requests: write` for the calling workflow. The action metadata cannot restrict the caller's `GITHUB_TOKEN` permissions.
- Pass the job's `GITHUB_TOKEN`; never pass a personal access token.
- Treat every filename, diff line, and model response as untrusted text. The diff is JSON-encoded as user data, and rendered Markdown is escaped before posting.
- Pull requests from forks are skipped before the diff is sent to the LLM. Their contents are controlled by the fork author, and their workflow token is normally read-only.
- The action never executes code from the pull request. The model can still misread a diff or fail to follow prompt instructions, so its review is advisory and requires human judgment.

The system prompt separates instructions from the JSON-encoded diff, but prompt injection cannot be eliminated by prompt wording alone. Do not grant this action extra repository permissions or give it secrets that are unnecessary for the review.

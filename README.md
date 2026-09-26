# CodeReview Bot — AI Code Review on GitHub Actions

![Status](https://img.shields.io/badge/status-em%20constru%C3%A7%C3%A3o-orange)
![Node](https://img.shields.io/badge/Node-%3E%3D18-green?logo=node.js&logoColor=white)
![AI](https://img.shields.io/badge/AI-LLM%20adapter-8A2BE2)
![License](https://img.shields.io/badge/license-MIT-green)

A GitHub Action that reviews pull requests with AI: fetches the PR diff, sends it through a
pluggable LLM adapter (OpenAI-compatible or local llama.cpp), and posts actionable review
comments back to the PR.

> 🇧🇷 Uma GitHub Action que revisa PRs com IA: pega o diff, passa por um adapter LLM
> plugável (OpenAI-compat ou llama.cpp local) e publica comentários acionáveis no PR.

## Features (roadmap)

- [ ] **M1a** — Action: PR diff → chunks → LLM → review comments
- [ ] **M1b** — Per-repo config (`.github/cr.yml`), structured logs
- [ ] **M2** — Review memory, executive summary + critical lines, adapter contract tests

## Built with

- LLM adapter pattern proven in my private AI lab (`ai_video_automation` stack)
- References: [anc95/ChatGPT-CodeReview](https://github.com/anc95/ChatGPT-CodeReview),
  [vercel-labs/openreview](https://github.com/vercel-labs/openreview)

## License

MIT — Rodolfo Franco ([FrancosCorporation](https://github.com/FrancosCorporation))

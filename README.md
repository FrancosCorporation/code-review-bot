# CodeReview Bot — AI Code Review on GitHub Actions

![Status](https://img.shields.io/badge/M1-funcionando%20(8%2F8%20testes)-brightgreen)
![CI](https://img.shields.io/badge/CI-test%20%2B%20license%20check-blue)
![Node](https://img.shields.io/badge/Node-%3E%3D18-green?logo=node.js&logoColor=white)
![AI](https://img.shields.io/badge/AI-LLM%20adapter-8A2BE2)
![License](https://img.shields.io/badge/license-MIT-green)

A GitHub Action that reviews pull requests with AI: fetches the PR diff, sends it through a
pluggable LLM adapter (OpenAI-compatible or local llama.cpp), and posts actionable review
comments back to the PR.

> 🇧🇷 Uma GitHub Action que revisa PRs com IA: pega o diff, passa por um adapter LLM
> plugável (OpenAI-compat ou llama.cpp local) e publica comentários acionáveis no PR.

## Features

- [x] **M1a** — Action: PR diff → chunks → LLM adapter → review comments (`action.yml` + `src/cr.js`)
- [x] **Core testado (8/8):** chunker de hunks, filtro por arquivo, adapter mock determinístico
      (detecta senha hardcoded, `eval()`, console.log, promise sem catch), markdown do comentário
- [x] **M1b (parcial):** config via inputs (idioma, severidade, ignorados) + CI com license-check
- [ ] **M1b (falta):** `.github/cr.yml` por repositório
- [ ] **M2** — Review memory, executive summary, adapter contract tests

## Como funciona

```mermaid
graph LR
  A[PR diff] --> B[chunker: hunks por arquivo]
  B --> C[LLM adapter plugável<br/>OpenAI-compat ou local]
  C --> D[comentário acionável<br/>🔴 crítico 🟡 aviso 🔵 info]
```

## Built with

- LLM adapter pattern proven in my private AI lab (`ai_video_automation` stack)
- References: [anc95/ChatGPT-CodeReview](https://github.com/anc95/ChatGPT-CodeReview),
  [vercel-labs/openreview](https://github.com/vercel-labs/openreview)

## License

MIT — Rodolfo Franco ([FrancosCorporation](https://github.com/FrancosCorporation))

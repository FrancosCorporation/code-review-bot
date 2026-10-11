# Code Review Bot

GitHub Action que lê o diff de um pull request, divide o conteúdo por arquivo e hunk, consulta um LLM compatível com a API OpenAI e publica um comentário agregado. Sem `llm_base_url` ou `llm_api_key`, usa um mock heurístico local sem rede.

## Uso com permissões mínimas

As permissões do `GITHUB_TOKEN` pertencem ao **workflow chamador**, não ao arquivo `action.yml` da Action. Use somente `contents: read` e `pull-requests: write` no job que executa a revisão:

```yaml
name: AI review
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      # Use a verified release tag or full commit SHA.
      - uses: FrancosCorporation/code-review-bot@<tag-or-SHA>
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          llm_base_url: ${{ vars.LLM_BASE_URL }}
          llm_api_key: ${{ secrets.LLM_API_KEY }}
          llm_model: llama-3.1-70b-instruct
          idioma: pt
          severidade: warn
          ignorados: '*.lock,dist/**'
          max_blocos: '20'
          max_diff_bytes: '102400'
```

Passe o `GITHUB_TOKEN` criado para o job. **Não use um PAT pessoal**: ele pode conceder acesso a outros repositórios e a Action não precisa dele. No `action.yml`, `github_token` representa o token do job chamador.

PRs de forks são ignorados antes de enviar qualquer diff ao LLM ou tentar comentar. O GitHub normalmente reduz o token de `pull_request` vindo de fork para somente leitura, mesmo que o workflow peça escrita. PRs da mesma origem seguem o fluxo normal; se a API negar a escrita por outra configuração, a Action registra um aviso e termina sem falha.

## Limites e configuração

- O diff é lido em streaming e limitado a 100 KiB por padrão. Ajuste `max_diff_bytes` entre 1 KiB e 1 MiB.
- Cada bloco enviado ao LLM tem no máximo 8 KiB e 150 linhas; o padrão permite até 20 blocos por PR. Ajuste `max_blocos` entre 1 e 50.
- Linhas longas são truncadas com marcador. O comentário informa truncamento e blocos que ficaram de fora.
- `ignorados` aceita substrings de caminho ou globs com `*`, separados por vírgula.
- Cada requisição ao LLM aceita até 1.500 tokens de saída, usa timeout de 30 segundos e pode ser repetida até três vezes.
- Requisições ao GitHub têm timeout de 15 segundos.

O prompt separa instruções do sistema e dados do diff serializados como JSON. Isso reduz a chance de prompt injection, mas não garante que qualquer modelo obedeça perfeitamente. O comentário é uma sugestão automática; revise os achados antes de agir.

## Desenvolvimento

O runner da Action usa Node.js 24. Para desenvolvimento local, requer Node.js 20 ou mais recente.

```bash
npm ci
npm run check
```

`npm test` executa a suíte existente com o mock local. O workflow de CI roda essa suíte junto com checagens estáticas e barreiras de segurança; ele não envia código de PR a um LLM.

## Segurança

Consulte [SECURITY.md](SECURITY.md) para o canal de reporte, o modelo de ameaça e os limites do token.

## Licença

MIT — Rodolfo Franco ([FrancosCorporation](https://github.com/FrancosCorporation)).

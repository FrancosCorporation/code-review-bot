// Formatação do comentário do review no PR (markdown bonito e acionável).
const ICONE = { critico: '🔴', warn: '🟡', info: '🔵' };

export function formatarComentario({ achados, porArquivo }) {
  const contagem = { critico: 0, warn: 0, info: 0 };
  for (const a of achados) contagem[a.severidade]++;

  const cabecalho = `## 🤖 AI Code Review\n\n**Resumo:** ${contagem.critico} crítico(s), ${contagem.warn} aviso(s), ${contagem.info} sugestão(ões)\n\n`;

  if (achados.length === 0) {
    return cabecalho + `✅ **Nenhum problema relevante encontrado.** Bom trabalho!\n\n<sub>Revisão automática — confira sempre com olhos humanos.</sub>\n`;
  }

  const porArquivoStr = porArquivo
    .filter((r) => r.achados.length > 0)
    .map((r) => {
      const itens = r.achados.map((a) =>
        `- ${ICONE[a.severidade]} **[${a.severidade}]** \`${a.linha}\`\n  → ${a.comentario}`
      ).join('\n');
      return `### 📄 ${r.arquivo}\n${itens}`;
    })
    .join('\n\n');

  return cabecalho + porArquivoStr + `\n\n<sub>🤖 Revisão automática por [code-review-bot](https://github.com/FrancosCorporation/code-review-bot) — confira sempre com olhos humanos.</sub>\n`;
}

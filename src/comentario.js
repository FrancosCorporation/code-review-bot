// Markdown do comentário do PR: todo conteúdo originado no diff/LLM é texto inerte.
const ICONE = { critico: '🔴', warn: '🟡', info: '🔵' };

function escaparMarkdown(valor) {
  return String(valor ?? '')
    .replace(/[\r\n]+/g, ' ⏎ ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_{}\[\]()#+\-.!|>~:])/g, '\\$1')
    .replace(/@(?=[a-z0-9_-])/gi, '@\u200b');
}

export function formatarComentario({ achados = [], porArquivo = [], avisos = [], totalBlocos = null }) {
  const contagem = { critico: 0, warn: 0, info: 0 };
  for (const achado of achados) if (Object.hasOwn(contagem, achado.severidade)) contagem[achado.severidade] += 1;

  const cabecalho = `> 🤖 Revisão gerada por IA. Não substitui a revisão humana.\n\n## 🤖 AI Code Review\n\n**Resumo:** ${contagem.critico} crítico(s), ${contagem.warn} aviso(s), ${contagem.info} sugestão(ões)\n`;
  const avisosMd = avisos.length
    ? `\n\n### Limites da revisão\n${avisos.map((aviso) => `- ⚠️ ${escaparMarkdown(aviso)}`).join('\n')}`
    : '';

  if (achados.length === 0) {
    const resumo = totalBlocos === 0
      ? 'ℹ️ Nenhum bloco de diff foi selecionado para revisão. Confira os filtros e limites configurados.'
      : avisos.length
      ? '✅ **Nenhum problema relevante nos trechos enviados ao modelo.** Consulte os limites da revisão acima.'
      : '✅ **Nenhum problema relevante encontrado.** Bom trabalho!';
    return `${cabecalho}${avisosMd}\n\n${resumo}\n\n<sub>Revisão automática — confira sempre com olhos humanos.</sub>\n`;
  }

  const porArquivoMd = porArquivo
    .filter((resultado) => resultado.achados.length > 0)
    .map((resultado) => {
      const itens = resultado.achados.map((achado) => {
        const icone = ICONE[achado.severidade] || '🔵';
        return `- ${icone} **[${escaparMarkdown(achado.severidade)}]** Trecho: ${escaparMarkdown(achado.linha)}\n  Sugestão: ${escaparMarkdown(achado.comentario)}`;
      }).join('\n');
      return `### 📄 ${escaparMarkdown(resultado.arquivo)}\n${itens}`;
    })
    .join('\n\n');

  return `${cabecalho}${avisosMd}\n\n${porArquivoMd}\n\n<sub>🤖 Revisão automática por [code-review-bot](https://github.com/FrancosCorporation/code-review-bot) — confira sempre com olhos humanos.</sub>\n`;
}

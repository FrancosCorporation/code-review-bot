// Diff chunker: separa o diff em hunks (por arquivo), com limite por arquivo e total.
export function separarArquivos(diff) {
  const arquivos = [];
  let atual = null;
  for (const linha of diff.split('\n')) {
    if (linha.startsWith('diff --git')) {
      const m = linha.match(/ b\/(.+)$/);
      atual = { arquivo: m ? m[1] : '?', hunks: [] };
      arquivos.push(atual);
    } else if (atual && linha.startsWith('@@')) {
      atual.hunks.push({ cabecalho: linha, linhas: [] });
    } else if (atual && atual.hunks.length && (linha.startsWith('+') || linha.startsWith('-') || linha.startsWith(' '))) {
      atual.hunks[atual.hunks.length - 1].linhas.push(linha);
    }
  }
  return arquivos.filter((a) => a.hunks.length > 0);
}

// agrupa hunks em blocos de no máximo maxLinhas (para respeitar o contexto do LLM)
export function agruparEmBlocos(arquivos, maxLinhas = 150) {
  const blocos = [];
  for (const a of arquivos) {
    let blocoAtual = null;
    for (const hunk of a.hunks) {
      const tamanho = hunk.linhas.length + 1;
      if (!blocoAtual || blocoAtual.linhas + tamanho > maxLinhas) {
        blocoAtual = { arquivo: a.arquivo, conteudo: [], linhas: 0 };
        blocos.push(blocoAtual);
      }
      blocoAtual.conteudo.push(hunk.cabecalho, ...hunk.linhas);
      blocoAtual.linhas += tamanho;
    }
  }
  return blocos.map((b, i) => ({ id: i + 1, arquivo: b.arquivo, linhas: b.linhas, diff: b.conteudo.join('\n') }));
}

// filtro por extensão/arquivo ignorado (config do .github/cr.yml)
export function filtrar(blocos, { ignorados = [], maxBlocos = 20 } = {}) {
  const ok = blocos.filter((b) => !ignorados.some((padrao) => b.arquivo.includes(padrao)));
  return ok.slice(0, maxBlocos);
}

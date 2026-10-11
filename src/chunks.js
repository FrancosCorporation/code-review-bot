// Diff chunker: separa por arquivo/hunk e limita linhas e bytes por bloco.
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
  return arquivos.filter((arquivo) => arquivo.hunks.length > 0);
}

function limitarLinha(linha, maxBytes) {
  const texto = String(linha);
  if (Buffer.byteLength(texto, 'utf8') <= maxBytes) return { texto, truncado: false };
  const marcador = ' …[linha truncada]';
  const disponivel = Math.max(0, maxBytes - Buffer.byteLength(marcador, 'utf8'));
  let prefixo = '';
  let usados = 0;
  for (const caractere of texto) {
    const tamanho = Buffer.byteLength(caractere, 'utf8');
    if (usados + tamanho > disponivel) break;
    prefixo += caractere;
    usados += tamanho;
  }
  return { texto: prefixo + marcador, truncado: true };
}

// Cada bloco respeita ambos os tetos. Hunk headers são repetidos ao dividir uma hunk longa.
export function agruparEmBlocos(arquivos, maxLinhas = 150, maxBytes = 8192) {
  const tetoLinhas = Math.max(2, Math.floor(maxLinhas));
  const tetoBytes = Math.max(256, Math.floor(maxBytes));
  const blocos = [];

  for (const arquivo of arquivos) {
    let blocoAtual = null;
    let hunkAtual = null;
    for (const hunk of arquivo.hunks) {
      const cabecalho = limitarLinha(hunk.cabecalho, Math.min(tetoBytes - 64, 1024));
      const linhas = hunk.linhas.length ? hunk.linhas : [''];
      const bytesCabecalho = Buffer.byteLength(cabecalho.texto, 'utf8');
      const maxBytesLinha = Math.max(1, tetoBytes - bytesCabecalho - 1);

      for (const linha of linhas) {
        const trecho = limitarLinha(linha, maxBytesLinha);
        let precisaCabecalho = blocoAtual === null || hunkAtual !== hunk;
        let bytesNovos = Buffer.byteLength(trecho.texto, 'utf8') + 1 + (precisaCabecalho ? bytesCabecalho + 1 : 0);
        let linhasNovas = 1 + (precisaCabecalho ? 1 : 0);
        if (!blocoAtual || blocoAtual.linhas + linhasNovas > tetoLinhas || blocoAtual.bytes + bytesNovos > tetoBytes) {
          blocoAtual = { arquivo: arquivo.arquivo, conteudo: [], linhas: 0, bytes: 0, truncado: false };
          blocos.push(blocoAtual);
          hunkAtual = null;
          precisaCabecalho = true;
          bytesNovos = Buffer.byteLength(trecho.texto, 'utf8') + bytesCabecalho + 2;
          linhasNovas = 2;
        }
        if (hunkAtual !== hunk) {
          blocoAtual.conteudo.push(cabecalho.texto);
          blocoAtual.linhas += 1;
          blocoAtual.bytes += bytesCabecalho + (blocoAtual.bytes ? 1 : 0);
          blocoAtual.truncado ||= cabecalho.truncado;
          hunkAtual = hunk;
        }
        blocoAtual.conteudo.push(trecho.texto);
        blocoAtual.linhas += 1;
        blocoAtual.bytes += Buffer.byteLength(trecho.texto, 'utf8') + 1;
        blocoAtual.truncado ||= trecho.truncado;
      }
    }
  }

  return blocos.map((bloco, indice) => ({
    id: indice + 1,
    arquivo: bloco.arquivo,
    linhas: bloco.linhas,
    bytes: Math.max(0, bloco.bytes - 1),
    truncado: bloco.truncado,
    diff: bloco.conteudo.join('\n')
  }));
}

function padraoIgnora(caminho, padrao) {
  if (!padrao.includes('*')) return caminho.includes(padrao);
  const regex = new RegExp(`^${padrao.split('*').map((parte) => parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  return regex.test(caminho);
}

// Patterns with * use glob matching; other entries are substring filters.
export function filtrar(blocos, { ignorados = [], maxBlocos = 20 } = {}) {
  const limite = Number.isFinite(Number(maxBlocos)) ? Math.max(1, Math.floor(Number(maxBlocos))) : 20;
  const validos = blocos.filter((bloco) => !ignorados.some((padrao) => padraoIgnora(bloco.arquivo, String(padrao))));
  return validos.slice(0, limite);
}

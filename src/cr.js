// Code Review Bot — GitHub Action: busca PR/diff, limita o contexto, revisa e comenta.
import { separarArquivos, agruparEmBlocos, filtrar } from './chunks.js';
import { criarAdapter } from './adapter.js';
import { formatarComentario } from './comentario.js';

const MAX_BYTES_BLOCO = 8 * 1024;
const MAX_BYTES_DIFF = 100 * 1024;
const MAX_BYTES_COMENTARIO = 60 * 1024;

function inteiroLimitado(valor, padrao, minimo, maximo) {
  const numero = Number.parseInt(valor, 10);
  return Number.isFinite(numero) ? Math.max(minimo, Math.min(maximo, numero)) : padrao;
}

export function lerConfig(env = process.env) {
  return {
    baseUrl: env.INPUT_LLM_BASE_URL || '',
    apiKey: env.INPUT_LLM_API_KEY || '',
    modelo: env.INPUT_LLM_MODEL || 'llama-3.1-70b-instruct',
    idioma: env.INPUT_IDIOMA === 'en' ? 'en' : 'pt',
    severidadeMinima: ['info', 'warn', 'critico'].includes(env.INPUT_SEVERIDADE) ? env.INPUT_SEVERIDADE : 'warn',
    ignorados: (env.INPUT_IGNORADOS || '').split(',').map((item) => item.trim()).filter(Boolean),
    maxBlocos: inteiroLimitado(env.INPUT_MAX_BLOCOS, 20, 1, 50),
    maxDiffBytes: inteiroLimitado(env.INPUT_MAX_DIFF_BYTES, MAX_BYTES_DIFF, 1024, 1024 * 1024),
    maxBytesBloco: MAX_BYTES_BLOCO
  };
}

const RANK = { info: 0, warn: 1, critico: 2 };

function truncarBytes(texto, maxBytes) {
  const buffer = Buffer.from(texto, 'utf8');
  if (buffer.byteLength <= maxBytes) return { texto, truncado: false };
  const parcial = buffer.subarray(0, maxBytes).toString('utf8');
  const ultimaLinhaCompleta = parcial.lastIndexOf('\n');
  return { texto: ultimaLinhaCompleta >= 0 ? parcial.slice(0, ultimaLinhaCompleta) : parcial, truncado: true };
}

function limitarComentario(texto) {
  const buffer = Buffer.from(texto, 'utf8');
  if (buffer.byteLength <= MAX_BYTES_COMENTARIO) return texto;
  const marcador = '\n\n⚠️ Comentário reduzido para caber no limite da API do GitHub.';
  const limite = MAX_BYTES_COMENTARIO - Buffer.byteLength(marcador, 'utf8');
  return buffer.subarray(0, limite).toString('utf8') + marcador;
}

export async function revisarDiff(diff, config = {}) {
  const cfg = { ...lerConfig(process.env), ...config };
  const entrada = String(diff ?? '');
  const limitado = truncarBytes(entrada, cfg.maxDiffBytes || MAX_BYTES_DIFF);
  const dif = limitado.texto;
  const todosBlocos = agruparEmBlocos(separarArquivos(dif), 150, cfg.maxBytesBloco || MAX_BYTES_BLOCO);
  const elegiveis = filtrar(todosBlocos, { ignorados: cfg.ignorados, maxBlocos: Math.max(1, todosBlocos.length) });
  const blocos = filtrar(elegiveis, { maxBlocos: cfg.maxBlocos });
  const blocosOmitidos = Math.max(0, elegiveis.length - blocos.length);
  const avisos = [];
  if (limitado.truncado || config.diffTruncado) avisos.push(`O diff foi limitado a ${cfg.maxDiffBytes} bytes; parte das alterações não foi revisada.`);
  if (blocos.some((bloco) => bloco.truncado)) avisos.push('Uma ou mais linhas foram truncadas para respeitar o limite de 8 KB por bloco.');
  if (blocosOmitidos) avisos.push(`${blocosOmitidos} bloco(s) adicional(is) foram omitidos pelo limite de custo configurado.`);

  const adapter = criarAdapter(cfg);
  const resultados = [];
  for (const bloco of blocos) {
    const resultado = await adapter.revisar({ arquivo: bloco.arquivo, diff: bloco.diff, idioma: cfg.idioma });
    resultados.push({ arquivo: bloco.arquivo, ...resultado });
  }
  const porArquivo = resultados.map((resultado) => ({
    ...resultado,
    achados: resultado.achados.filter((achado) => RANK[achado.severidade] >= RANK[cfg.severidadeMinima])
  }));
  const achados = porArquivo.flatMap((resultado) => resultado.achados);
  return { achados, porArquivo, totalBlocos: blocos.length, blocosOmitidos, avisos };
}

async function lerTextoLimitado(response, maxBytes) {
  const declarado = Number(response.headers.get('content-length'));
  const leitor = response.body?.getReader();
  if (!leitor) {
    const texto = await response.text();
    const limitado = truncarBytes(texto, maxBytes);
    return { ...limitado, truncado: limitado.truncado || declarado > maxBytes };
  }

  const partes = [];
  let total = 0;
  let truncado = declarado > maxBytes;
  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;
    const restante = maxBytes - total;
    if (value.byteLength > restante) {
      if (restante > 0) partes.push(value.subarray(0, restante));
      total += Math.max(0, restante);
      truncado = true;
      await leitor.cancel().catch(() => {});
      break;
    }
    partes.push(value);
    total += value.byteLength;
  }
  const bytes = new Uint8Array(total);
  let deslocamento = 0;
  for (const parte of partes) {
    bytes.set(parte, deslocamento);
    deslocamento += parte.byteLength;
  }
  let texto = new TextDecoder().decode(bytes);
  if (truncado) {
    const ultimaLinhaCompleta = texto.lastIndexOf('\n');
    if (ultimaLinhaCompleta >= 0) texto = texto.slice(0, ultimaLinhaCompleta);
  }
  return { texto, truncado };
}

function escaparComandoActions(valor) {
  return String(valor).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/:/g, '%3A').replace(/,/g, '%2C');
}

export async function rodarAction(env = process.env, fetchImpl = globalThis.fetch, log = console.log) {
  const token = env.INPUT_GITHUB_TOKEN;
  const partesRepo = (env.GITHUB_REPOSITORY || '').split('/');
  const matchPr = (env.GITHUB_REF || '').match(/^refs\/pull\/(\d+)\/(?:merge|head)$/);
  const prNumero = Number(matchPr?.[1] || 0);
  if (!token || partesRepo.length !== 2 || !partesRepo.every(Boolean) || !prNumero) {
    throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY e um pull_request válido são obrigatórios');
  }

  const [dono, repo] = partesRepo;
  const api = `https://api.github.com/repos/${dono}/${repo}`;
  const headersBase = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'code-review-bot'
  };
  const timeoutGithub = 15_000;
  const respostaPr = await fetchImpl(`${api}/pulls/${prNumero}`, {
    headers: headersBase,
    signal: AbortSignal.timeout(timeoutGithub)
  });
  if (!respostaPr.ok) throw new Error(`GitHub não conseguiu ler o PR (${respostaPr.status})`);
  const pr = await respostaPr.json();
  if (String(pr.base?.repo?.full_name || '').toLowerCase() !== `${dono}/${repo}`.toLowerCase()) {
    throw new Error('O PR retornado não corresponde ao repositório do workflow');
  }
  if (pr.state !== 'open') {
    log(`::notice:: PR #${prNumero} não está aberto; revisão ignorada.`);
    return { comentado: false, motivo: 'pr-fechado' };
  }
  const repoHead = pr.head?.repo?.full_name;
  const repoBase = pr.base?.repo?.full_name;
  if (!repoHead || !repoBase) {
    log('::warning:: Origem do PR não pôde ser confirmada; revisão ignorada.');
    return { comentado: false, motivo: 'origem-desconhecida' };
  }
  if (repoHead.toLowerCase() !== repoBase.toLowerCase()) {
    log(`::notice:: PR #${prNumero} vem de fork; não será enviado conteúdo ao LLM nem comentário.`);
    return { comentado: false, motivo: 'fork' };
  }

  const cfg = lerConfig(env);
  const respostaDiff = await fetchImpl(`${api}/pulls/${prNumero}`, {
    headers: { ...headersBase, Accept: 'application/vnd.github.diff' },
    signal: AbortSignal.timeout(timeoutGithub)
  });
  if (!respostaDiff.ok) throw new Error(`GitHub não conseguiu ler o diff (${respostaDiff.status})`);
  const diffLido = await lerTextoLimitado(respostaDiff, cfg.maxDiffBytes);
  const resultado = await revisarDiff(diffLido.texto, { ...cfg, diffTruncado: diffLido.truncado });
  log(`::notice:: ${resultado.achados.length} achados em ${resultado.totalBlocos} blocos revisados.`);

  const comentario = limitarComentario(formatarComentario(resultado));
  const respostaComentario = await fetchImpl(`${api}/issues/${prNumero}/comments`, {
    method: 'POST',
    headers: headersBase,
    body: JSON.stringify({ body: comentario }),
    signal: AbortSignal.timeout(timeoutGithub)
  });
  if (respostaComentario.status === 403) {
    log('::warning:: GitHub recusou o comentário. Verifique pull-requests: write; tokens em workflows de fork são somente leitura.');
    return { comentado: false, motivo: 'sem-permissao', resultado };
  }
  if (!respostaComentario.ok) throw new Error(`GitHub não conseguiu publicar o comentário (${respostaComentario.status})`);
  return { comentado: true, resultado };
}

if (process.env.CODE_REVIEW_BOT_NO_ACTION !== '1' && process.env.GITHUB_ACTIONS === 'true') {
  rodarAction().catch((erro) => {
    console.log(`::error::${escaparComandoActions(erro?.message || 'falha na revisão')}`);
    process.exitCode = 1;
  });
}

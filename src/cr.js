// Code Review Bot — main (GitHub Action): diff → chunks → adapter → comentário no PR.
// Roda como node20 action; exportado p/ testes.
import { separarArquivos, agruparEmBlocos, filtrar } from './chunks.js';
import { criarAdapter } from './adapter.js';
import { formatarComentario } from './comentario.js';

export function lerConfig(env) {
  const ignorados = (env.INPUT_IGNORADOS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    baseUrl: env.INPUT_LLM_BASE_URL || '',
    apiKey: env.INPUT_LLM_API_KEY || '',
    modelo: env.INPUT_LLM_MODEL || 'llama-3.1-70b-instruct',
    idioma: env.INPUT_IDIOMA === 'en' ? 'en' : 'pt',
    severidadeMinima: ['info', 'warn', 'critico'].includes(env.INPUT_SEVERIDADE) ? env.INPUT_SEVERIDADE : 'warn',
    ignorados
  };
}

const RANK = { info: 0, warn: 1, critico: 2 };

export async function revisarDiff(diff, config = {}) {
  const cfg = { ...lerConfig(process.env), ...config };
  const adapter = criarAdapter(cfg);
  const blocos = filtrar(agruparEmBlocos(separarArquivos(diff), 150), cfg);
  const resultados = [];
  for (const bloco of blocos) {
    const r = await adapter.revisar({ arquivo: bloco.arquivo, diff: bloco.diff, idioma: cfg.idioma });
    resultados.push({ arquivo: bloco.arquivo, ...r });
  }
  const achados = resultados
    .flatMap((r) => r.achados)
    .filter((a) => RANK[a.severidade] >= RANK[cfg.severidadeMinima]);
  return { achados, porArquivo: resultados, totalBlocos: blocos.length };
}

// Entry da action (fora dos testes)
async function rodarAction() {
  const token = process.env.INPUT_GITHUB_TOKEN;
  const [dono, repo] = (process.env.GITHUB_REPOSITORY || 'd/r').split('/');
  const prNumero = Number((process.env.GITHUB_REF || '').match(/refs\/pull\/(\d+)\/merge/)?.[1] || 0);
  if (!token || !prNumero) {
    console.log('::error:: sem token/PR — a action roda em pull_request');
    process.exit(1);
  }
  const api = `https://api.github.com/repos/${dono}/${repo}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'code-review-bot' };

  const diff = await fetch(`${api}/pulls/${prNumero}`, { headers }).then((r) => r.text());
  const resultado = await revisarDiff(diff);
  console.log(`::notice:: ${resultado.achados.length} achados em ${resultado.totalBlocos} blocos`);

  await fetch(`${api}/issues/${prNumero}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body: formatarComentario(resultado) })
  });
}

if (process.env.KANBANEX_NO_LISTEN !== '1' && process.env.GITHUB_ACTIONS === 'true') {
  rodarAction().catch((e) => { console.log('::error:: ' + e.message); process.exit(1); });
}

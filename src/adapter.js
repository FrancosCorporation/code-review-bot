// Adapter LLM plugável: OpenAI-compat (http real) + Mock determinístico (testes).
// Padrão validado: fallback explícito + retry/backoff (do llm_adapter do meu lab).

export function criarAdapter({ baseUrl = '', apiKey = '', modelo = 'llama-3.1-70b-instruct', tentativas = 3 } = {}) {
  const mock = !baseUrl || !apiKey;

  async function revisar({ arquivo, diff, idioma = 'pt' }) {
    if (mock) return revisarMock({ arquivo, diff });
    return revisarLLM({ arquivo, diff, idioma });
  }

  async function revisarLLM({ arquivo, diff, idioma }) {
    const prompt = `Você é um revisor de código sênior e implacável. Revise este diff de "${arquivo}".
Responda em JSON estrito: {"achados":[{"severidade":"info|warn|critico","linha":"<trecho do diff>","comentario":"<sugestão acionável em ${idioma}>"}],"resumo":"<1 frase em ${idioma}>"}.
Se não houver problemas reais, devolva {"achados":[],"resumo":"..."}. NÃO invente problemas.
DIFF:\n${diff}`;

    let ultimoErro = null;
    for (let t = 0; t < tentativas; t++) {
      try {
        const r = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: modelo,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 1500
          })
        });
        if (!r.ok) throw new Error(`LLM ${r.status}`);
        const dados = await r.json();
        const conteudo = dados.choices?.[0]?.message?.content || '{}';
        const json = JSON.parse(conteudo.replace(/^```json\s*|```$/g, '').trim());
        return normalizar(json);
      } catch (e) {
        ultimoErro = e;
        await new Promise((r) => setTimeout(r, 1000 * 2 ** t)); // backoff exponencial
      }
    }
    throw Object.assign(new Error(`LLM falhou após ${tentativas} tentativas: ${ultimoErro?.message}`), { codigo: 'llm_indisponivel' });
  }

  // Mock determinístico (testes + modo offline): regras heurísticas reais, zero rede
  function revisarMock({ arquivo, diff }) {
    const achados = [];
    for (const linha of diff.split('\n')) {
      if (linha.startsWith('+') && /eval\(/.test(linha)) {
        achados.push({ severidade: 'critico', linha: linha.slice(0, 60), comentario: 'eval() é inseguro — use parse seguro ou sandbox.' });
      }
      if (linha.startsWith('+') && /(senha|password|token|api_?key)\s*[:=]\s*['"][^'"]{6,}/i.test(linha)) {
        achados.push({ severidade: 'critico', linha: linha.slice(0, 60), comentario: 'Credencial hardcoded — mova para env/secrets.' });
      }
      if (linha.startsWith('+') && /console\.log\(/.test(linha)) {
        achados.push({ severidade: 'info', linha: linha.slice(0, 60), comentario: 'console.log deixado no código — remova ou use logger estruturado.' });
      }
      if (linha.startsWith('+') && /\.then\(/.test(linha) && !/catch|\.catch/.test(diff)) {
        achados.push({ severidade: 'warn', linha: linha.slice(0, 60), comentario: 'Promise sem .catch — trate a rejeição.' });
      }
    }
    const resumo = achados.length
      ? `${achados.filter((a) => a.severidade !== 'info').length} problema(s) relevante(s) em ${arquivo}.`
      : `Sem problemas relevantes em ${arquivo}.`;
    return { achados, resumo };
  }

  function normalizar(json) {
    const achados = (json.achados || [])
      .filter((a) => ['info', 'warn', 'critico'].includes(a.severidade) && a.comentario)
      .map((a) => ({ severidade: a.severidade, linha: (a.linha || '').slice(0, 80), comentario: String(a.comentario).slice(0, 400) }));
    return { achados, resumo: String(json.resumo || '').slice(0, 300) };
  }

  return { revisar, mock };
}

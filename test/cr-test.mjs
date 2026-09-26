// Testes do CodeReview Bot (mock determinístico — zero rede). Uso: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { separarArquivos, agruparEmBlocos, filtrar } from '../src/chunks.js';
import { criarAdapter } from '../src/adapter.js';
import { formatarComentario } from '../src/comentario.js';
import { revisarDiff, lerConfig } from '../src/cr.js';

const DIFF = `diff --git a/src/app.js b/src/app.js
@@ -1,4 +1,9 @@
 const x = 1;
+const senha = "supersecreta123";
+console.log("debug aqui");
+eval(userInput);
 function ola() {
+  fetch("/api").then(r => r.json());
   return x;
 }
diff --git a/src/util.js b/src/util.js
@@ -1,3 +1,6 @@
+const y = 2;
+function teste(a, b) { return a + b; }
+module.exports = { teste };
diff --git a/README.md b/README.md
@@ -1,2 +1,3 @@
+# docs

`;

test('chunker separa arquivos e ignora os sem hunks', () => {
  const arquivos = separarArquivos(DIFF);
  assert.equal(arquivos.length, 3);
  assert.equal(arquivos[0].arquivo, 'src/app.js');
  assert.ok(arquivos[0].hunks[0].linhas.some((l) => l.includes('senha')));
});

test('chunker agrupa em blocos com limite de linhas', () => {
  const blocos = agruparEmBlocos(separarArquivos(DIFF), 10);
  assert.ok(blocos.length >= 2);
  for (const b of blocos) assert.ok(b.linhas <= 10 + 10);
});

test('filtro respeita arquivos ignorados', () => {
  const blocos = agruparEmBlocos(separarArquivos(DIFF));
  const ok = filtrar(blocos, { ignorados: ['README.md'] });
  assert.equal(ok.length, 2);
  assert.ok(!ok.some((b) => b.arquivo === 'README.md'));
});

test('mock adapter: detecta senha hardcoded, eval e console.log', async () => {
  const adapter = criarAdapter({}); // sem baseUrl/apiKey => mock
  const r = await adapter.revisar({ arquivo: 'src/app.js', diff: '+const senha = "supersecreta123";\n+eval(x);\n+console.log("debug");' });
  const severidades = r.achados.map((a) => a.severidade);
  assert.ok(severidades.includes('critico'), 'senha+eval = critico');
  assert.ok(severidades.includes('info'), 'console.log = info');
  assert.ok(r.resumo.length > 5);
});

test('mock adapter: código limpo => sem achados', async () => {
  const adapter = criarAdapter({});
  const r = await adapter.revisar({ arquivo: 'src/util.js', diff: '+function teste(a, b) { return a + b; }' });
  assert.equal(r.achados.length, 0);
});

test('formatarComentario: markdown com ícones e resumo', async () => {
  const r = await revisarDiff(DIFF, { severidadeMinima: 'info' });
  const md = formatarComentario(r);
  assert.ok(md.includes('🤖 AI Code Review'));
  assert.ok(md.includes('🔴') || md.includes('🟡') || md.includes('🔵'));
  assert.ok(md.includes('src/app.js'));
  assert.ok(md.includes('code-review-bot'));
});

test('severidadeMinima filtra info quando warn', async () => {
  const r = await revisarDiff(DIFF, { severidadeMinima: 'warn' });
  assert.ok(r.achados.every((a) => a.severidade !== 'info'));
});

test('lerConfig: padrões e ignorados', () => {
  const cfg = lerConfig({ INPUT_IDIOMA: 'en', INPUT_SEVERIDADE: 'info', INPUT_IGNORADOS: 'dist/, node_modules' });
  assert.equal(cfg.idioma, 'en');
  assert.equal(cfg.severidadeMinima, 'info');
  assert.deepEqual(cfg.ignorados, ['dist/', 'node_modules']);
});

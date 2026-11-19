// index.html と src/*.js を1枚のHTMLにまとめる。
// 使い方: node tools/build-artifact.mjs <出力パス> [--fragment]
//   --fragment: <!doctype>/<html>/<head>/<body> を外した断片を出力（claude.ai の Artifact 用）
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2];
const fragment = process.argv.includes('--fragment');
if (!out) {
  console.error('usage: node tools/build-artifact.mjs <out.html> [--fragment]');
  process.exit(1);
}
let html = readFileSync(join(root, 'index.html'), 'utf8');
// ホーム画面追加用（manifest・アイコン・Service Worker）は別ファイル前提なので1枚版では外す
html = html.replace(/<!--PWA-->[\s\S]*?<!--PWA-END-->\n?/g, '');
html = html.replace(/<!--BUILD:SCRIPTS-->([\s\S]*?)<!--BUILD:SCRIPTS-END-->/, (_, block) => {
  const srcs = [...block.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  const code = srcs.map((s) => `// ---- ${s} ----\n` + readFileSync(join(root, s), 'utf8')).join('\n');
  return `<script>\n${code.replace(/<\/script/gi, '<\\/script')}\n</script>`;
});
if (fragment) {
  const head = html.match(/<!--BUILD:HEAD-->([\s\S]*?)<!--BUILD:HEAD-END-->/)[1];
  const body = html.match(/<!--BUILD:BODY-->([\s\S]*?)<!--BUILD:BODY-END-->/)[1];
  html = head.trim() + '\n' + body.trim() + '\n';
}
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(1)} KB)`);

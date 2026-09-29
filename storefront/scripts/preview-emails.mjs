/** Render the real templates with sample data, without sending or DB access. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(root, process.argv[2] || '../tmp/email-preview');
// These preview tokens are deliberately unrelated to any live credentials.
process.env.ORDER_ACCESS_SECRET = 'local-email-preview-only-never-use-in-production';
const vite = await createServer({
  root, configFile: false, envDir: false,
  server: { middlewareMode: true, watch: null },
  resolve: { alias: [
    { find: '@/lib/settings', replacement: path.join(root, 'scripts/email-preview-settings.ts') },
    { find: '@', replacement: root },
    { find: 'server-only', replacement: path.join(root, 'tests/helpers/server-only.ts') },
  ] },
});

try {
  const { renderTemplate } = await vite.ssrLoadModule('/lib/email/templates.ts');
  const { TEMPLATE_GROUPS, samplePayload } = await vite.ssrLoadModule('/lib/email/samples.ts');
  const { escapeEmailHtml: esc } = await vite.ssrLoadModule('/lib/email/layout.ts');
  await mkdir(output, { recursive: true });
  const templates = [];
  for (const group of TEMPLATE_GROUPS) {
    for (const template of group.templates) {
      const email = await renderTemplate(template.id, samplePayload(template.id));
      await writeFile(path.join(output, `${template.id}.html`), email.html);
      templates.push({ ...template, group: group.label, subject: email.subject });
    }
  }
  const initial = templates.find(t => t.id === 'order_confirmation');
  const menu = TEMPLATE_GROUPS.map(group => `<optgroup label="${esc(group.label)}">${templates.filter(t => t.group === group.label).map(t => `<option value="${t.id}" ${t.id === initial.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</optgroup>`).join('');
  await writeFile(path.join(output, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>East Coast Labs · Email collection</title>
<style>*{box-sizing:border-box}body{margin:0;background:#edf3f7;color:#152e46;font:16px/1.5 Arial,Helvetica,sans-serif}header{padding:24px 32px;background:#152e46;color:white}header span{font-size:11px;letter-spacing:2px;color:#c4d8e8}h1{font-size:24px;line-height:1.25;font-weight:500;margin:8px 0}header p{margin:0;color:#c4d8e8;font-size:14px}.toolbar{padding:20px 32px;background:#fff;border-bottom:1px solid #dbe3e9;display:flex;align-items:end;gap:24px;flex-wrap:wrap}label{font-size:12px;display:grid;gap:6px;color:#536577}select,button{font:14px Arial;color:#152e46;background:#fff;border:1px solid #b8c9d6;border-radius:4px;min-height:42px;padding:10px 14px}select{max-width:100%}button{cursor:pointer}button[aria-pressed=true]{background:#152e46;color:#fff;border-color:#152e46}.sizes{display:flex;gap:6px}main{padding:28px 16px}.subject{max-width:720px;margin:0 auto 18px;font-size:14px}.subject span{display:block;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#536577;margin-bottom:4px}iframe{display:block;width:720px;max-width:100%;height:1200px;border:0;margin:auto;background:#edf3f7}footer{padding:12px;text-align:center;font-size:12px;color:#536577}@media(max-width:500px){header,.toolbar{padding:20px}main{padding:18px 0}.subject{padding:0 20px}}</style></head><body>
<header><span>EAST COAST LABS</span><h1>A consistent customer experience.</h1><p>25 emails · Navy brand direction · Local preview with sample data</p></header>
<div class="toolbar"><label>Email template<select id="template">${menu}</select></label><div><label>Preview width</label><div class="sizes"><button data-width="720" aria-pressed="true">Desktop</button><button data-width="390" aria-pressed="false">Mobile</button><button data-width="320" aria-pressed="false">Small mobile</button></div></div></div>
<main><p class="subject"><span>Email subject</span><strong id="subject">${esc(initial.subject)}</strong></p><iframe id="preview" title="Email preview" src="${initial.id}.html" sandbox="allow-same-origin"></iframe></main>
<footer>Sample payment and contact details only. Nothing has been sent. Preview links are inactive.</footer>
<script>const templates=${JSON.stringify(templates).replace(/</g, '\\u003c')};const frame=document.getElementById('preview');document.getElementById('template').addEventListener('change',event=>{const template=templates.find(t=>t.id===event.target.value);frame.src=template.id+'.html';document.getElementById('subject').textContent=template.subject});document.querySelectorAll('[data-width]').forEach(button=>button.addEventListener('click',()=>{frame.style.width=button.dataset.width+'px';document.querySelectorAll('[data-width]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)))}));frame.addEventListener('load',()=>{frame.contentDocument.addEventListener('click',event=>event.preventDefault());frame.style.height=Math.max(700,frame.contentDocument.documentElement.scrollHeight+12)+'px'});new ResizeObserver(()=>{if(frame.contentDocument?.body){frame.style.height='700px';frame.style.height=Math.max(700,frame.contentDocument.documentElement.scrollHeight+12)+'px'}}).observe(frame);</script>
</body></html>`);
  console.log(`Rendered ${templates.length} emails: ${path.join(output, 'index.html')}`);
} finally {
  await vite.close();
}

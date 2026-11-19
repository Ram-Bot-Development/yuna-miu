const CSS = `
:root {
  color-scheme: dark;
  --bg: #09060f;
  --ink: #f6f2fb;
  --muted: #b9a8c9;
  --pink: #ff4f9a;
  --pink-2: #ff8ec4;
  --line: rgba(255, 79, 154, 0.55);
  --panel: rgba(16, 10, 22, 0.9);
  --card: #17111f;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  background:
    radial-gradient(900px 480px at 85% -10%, rgba(255, 70, 160, 0.28), transparent 55%),
    radial-gradient(700px 420px at 0% 10%, rgba(124, 70, 255, 0.22), transparent 50%),
    linear-gradient(180deg, #160a1c, var(--bg) 42%);
  font: 16px/1.45 "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
}
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: linear-gradient(180deg, transparent, #000 18%, #000 78%, transparent);
}
a { color: var(--pink-2); text-decoration: none; }
a:hover { color: white; }
h1 { margin: 0 0 0.35rem; letter-spacing: -0.03em; }
h2 { margin: 0; font-size: 1rem; }
p { margin: 0.3rem 0; }
.topbar {
  position: sticky;
  top: 0;
  z-index: 3;
  height: 58px;
  display: flex;
  align-items: center;
  background: rgba(8, 6, 12, 0.94);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.topbar-inner, .hero, .sheet {
  width: min(1040px, calc(100% - 2rem));
  margin: 0 auto;
}
.topbar-inner { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.brand { display: flex; align-items: center; gap: 0.55rem; color: white; font-weight: 750; }
.paw, .brand-icon {
  width: 1.7rem;
  height: 1.7rem;
  border-radius: 0.5rem;
  object-fit: cover;
  flex: none;
}
.paw {
  background: linear-gradient(135deg, #ff6ea8, #8b5cff);
  box-shadow: 0 0 0 4px rgba(255, 79, 154, 0.15);
}
.hero-side { display: grid; gap: 1rem; justify-items: center; align-content: start; }
.hero-side .snapshot { width: 100%; }
.portrait {
  width: min(220px, 70%);
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 22px;
  border: 1px solid var(--line);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4);
  justify-self: center;
}
.nav { display: flex; align-items: center; gap: 1rem; color: #ddd; font-size: 0.92rem; }
.nav a { color: #eee; }
.user { color: var(--muted); max-width: 12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
header form { margin: 0; }
.hero { display: grid; grid-template-columns: 1.25fr 0.85fr; gap: 1.4rem; align-items: center; padding: 4.2rem 0 3rem; }
.kicker { color: var(--pink-2); font-size: 0.75rem; font-weight: 750; letter-spacing: 0.16em; text-transform: uppercase; }
.hero h1 { font-size: clamp(2.3rem, 5vw, 3.5rem); line-height: 1.05; max-width: 14ch; }
.lede, .hint, small { color: var(--muted); }
.actions { display: flex; flex-wrap: wrap; gap: 0.55rem; margin-top: 1rem; }
.snapshot, .sheet, .server {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 18px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38);
}
.snapshot { padding: 1rem 1.1rem 1.1rem; }
.snapshot h2 { color: white; margin-bottom: 0.7rem; }
.snapshot li { margin: 0.45rem 0; }
.sheet { margin: 1.5rem auto 3rem; padding: 1.35rem 1.25rem 1.4rem; }
.sheet.narrow { width: min(32rem, calc(100% - 2rem)); }
.sheet.narrow .portrait { width: 4.5rem; margin-bottom: 0.7rem; }
.sheet > h1, .center { text-align: center; color: var(--pink-2); }
.sub { text-align: center; color: var(--muted); margin-bottom: 1rem; }
.group { margin: 1.1rem 0 0.65rem; color: var(--pink-2); }
.servers { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.9rem; }
.server { background: var(--card); padding: 0.75rem; display: grid; gap: 0.55rem; }
.mark {
  width: 100%;
  aspect-ratio: 1.15;
  border-radius: 12px;
  object-fit: cover;
  display: grid;
  place-items: center;
  background: linear-gradient(160deg, #ff7ab6, #6d5cff);
  color: white;
  font-size: 2.6rem;
  font-weight: 750;
}
.rows, form { display: grid; gap: 0.65rem; }
.block { display: grid; gap: 0.45rem; margin-top: 0.4rem; }
.block h2 { color: white; }
.row, .check {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin: 0;
  padding: 0.72rem 0.85rem;
  border: 1px solid rgba(255, 120, 180, 0.28);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.28);
}
.row-copy { display: grid; gap: 0.1rem; }
.row-copy strong { font-weight: 650; }
.row input, .switch-only {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}
.track {
  width: 46px;
  height: 26px;
  border-radius: 999px;
  background: #3a3148;
  position: relative;
  flex: none;
}
.track::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  transition: transform 0.15s ease;
}
.row input:checked + .track, .check input:checked + .track { background: var(--pink); }
.row input:checked + .track::after, .check input:checked + .track::after { transform: translateX(20px); }
.row input:focus-visible + .track, .check input:focus-visible + .track { outline: 2px solid white; outline-offset: 3px; }
.check { justify-content: flex-start; }
.check input { accent-color: var(--pink); width: 1rem; height: 1rem; flex: none; }
.picker {
  max-height: 16rem;
  overflow: auto;
  display: grid;
  gap: 0.4rem;
  padding: 0.15rem;
}
.filter, input[type="number"], select {
  width: 100%;
  background: #100b16;
  color: var(--ink);
  border: 1px solid rgba(255, 120, 180, 0.45);
  border-radius: 10px;
  padding: 0.62rem 0.75rem;
  font: inherit;
}
.split { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0.7rem; }
.field { display: grid; gap: 0.3rem; color: var(--muted); font-size: 0.92rem; }
.notice {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 0.75rem 0.9rem;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.03);
}
.toast { border-radius: 12px; padding: 0.7rem 0.85rem; }
.toast.error { background: rgba(255, 80, 110, 0.14); color: #ffc0cc; }
.toast.saved { background: rgba(80, 200, 140, 0.14); color: #c8f8d8; }
button, a.button {
  background: var(--pink);
  color: white;
  border: 0;
  border-radius: 9px;
  padding: 0.48rem 0.85rem;
  font: inherit;
  font-weight: 750;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
button:hover, a.button:hover { filter: brightness(1.08); color: white; }
button.ghost, a.button.ghost {
  background: transparent;
  color: #f3d48a;
  border: 1px solid #e6c36a;
}
button.ghost:hover, a.button.ghost:hover { background: rgba(230, 195, 106, 0.08); color: white; }
a.button.discord { background: #5865f2; }
.savebar {
  position: sticky;
  bottom: 0.75rem;
  display: flex;
  justify-content: flex-end;
  padding: 0.65rem;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: rgba(12, 8, 16, 0.92);
}
.stage { min-height: calc(100vh - 58px); display: grid; place-items: center; padding: 1.5rem 0 2rem; }
p, h1, h2, label { overflow-wrap: anywhere; }
@media (max-width: 800px) {
  .hero { grid-template-columns: 1fr; padding-top: 2rem; }
  .hero h1 { max-width: none; }
}
`.trim();

const FILTER = `<script>
function filterList(input) {
  var query = input.value.trim().toLowerCase();
  var root = input.parentElement;
  if (!root) return;
  var rows = root.querySelectorAll('.check');
  for (var i = 0; i < rows.length; i++) {
    var text = (rows[i].textContent || '').toLowerCase();
    rows[i].hidden = query.length > 0 && text.indexOf(query) === -1;
  }
}
</script>`;

export function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

const BOT_ICON =
    /^https:\/\/cdn\.discordapp\.com\/(?:avatars\/\d{17,20}\/[A-Za-z0-9_]{2,64}|embed\/avatars\/[0-5])\.(?:png|webp|gif|jpe?g)(?:\?size=(?:16|32|64|128|256|512|1024|2048|4096))?$/;

/** Keep only a Discord CDN avatar URL so it can be used in the page and as the site icon. */
export function sanitizeBotIcon(value: string | null | undefined): string | null {
    if (!value || !BOT_ICON.test(value)) return null;
    return value;
}

export function page(title: string, body: string, icon: string | null = null): string {
    const safe = sanitizeBotIcon(icon);
    const icons = safe
        ? `<link rel="icon" href="${escapeHtml(safe)}">
<link rel="apple-touch-icon" href="${escapeHtml(safe)}">
<meta property="og:image" content="${escapeHtml(safe)}">`
        : '';
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${icons}
<style>${CSS}</style>
</head>
<body>
${body}
${FILTER}
</body>
</html>`;
}

export function csrfField(csrf: string): string {
    return `<input type="hidden" name="csrf" value="${escapeHtml(csrf)}">`;
}

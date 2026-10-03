import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomBytes } from 'node:crypto';
import { Public } from './public.decorator';

/**
 * The page a password-recovery e-mail links to (B13, WHI-150). The token rides
 * in the URL fragment, which a browser never sends: this response is the same
 * static page for everyone and no server or proxy log ever holds a token. The
 * page offers to continue in the app (`inova://reset?token=…`) and, without
 * it, sets the password here through `POST recovery/confirm`.
 *
 * Its script runs under a per-response nonce and the page may talk only to
 * this origin. TODO(M10): the brand's name, colours and app scheme.
 */
@Controller('auth')
export class ResetPageController {
  @Public()
  @Get('reset')
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  page(@Res({ passthrough: true }) res: Response): string {
    const nonce = randomBytes(16).toString('base64');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'none'",
        `script-src 'nonce-${nonce}'`,
        `style-src 'nonce-${nonce}'`,
        "connect-src 'self'",
        "form-action 'none'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
      ].join('; '),
    );
    return RESET_PAGE.replaceAll('__NONCE__', nonce);
  }
}

const RESET_PAGE = `<!doctype html>
<html lang="bg">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Нова парола — inova</title>
<style nonce="__NONCE__">
  :root { color-scheme: light dark; --accent: #eb5e28; --ink: #1d1d1f; --muted: #766754; --bg: #efece3; --card: #ffffff; }
  @media (prefers-color-scheme: dark) { :root { --ink: #efece3; --muted: #a79d90; --bg: #1d1d1f; --card: #2c2324; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
         background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { width: 100%; max-width: 420px; background: var(--card); border-radius: 20px; padding: 28px 24px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  p { margin: 0 0 16px; color: var(--muted); }
  label { display: block; font-weight: 600; margin: 12px 0 4px; }
  input { width: 100%; font: inherit; padding: 12px; border-radius: 12px; border: 1px solid var(--muted); background: transparent; color: inherit; }
  button, a.button { display: block; width: 100%; text-align: center; font: inherit; font-weight: 600; padding: 12px;
                     border-radius: 12px; border: 0; margin-top: 16px; cursor: pointer; text-decoration: none; }
  .primary { background: var(--accent); color: #fff; }
  a.button.secondary { background: transparent; color: var(--accent); border: 1px solid var(--accent); }
  .or { text-align: center; margin: 20px 0 0; }
  .error { color: #c0392b; margin-top: 12px; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<main>
  <section id="form-view" hidden>
    <h1>Нова парола</h1>
    <p>Задайте нова парола за профила си в inova.</p>
    <a id="open-app" class="button secondary" href="#">Отвори в приложението</a>
    <p class="or">или я задайте тук</p>
    <form id="form" novalidate>
      <label for="password">Нова парола</label>
      <input id="password" type="password" autocomplete="new-password" minlength="8" required>
      <label for="repeat">Повторете паролата</label>
      <input id="repeat" type="password" autocomplete="new-password" minlength="8" required>
      <p id="error" class="error" role="alert" hidden></p>
      <button id="submit" class="primary" type="submit">Запази паролата</button>
    </form>
  </section>
  <section id="done-view" hidden>
    <h1>Паролата е сменена</h1>
    <p>Влезте в приложението inova с новата парола. Всички стари влизания са прекратени.</p>
  </section>
  <section id="invalid-view" hidden>
    <h1>Линкът не важи</h1>
    <p>Линкът е изтекъл или вече е използван. Поискайте нов от приложението — «Забравена парола».</p>
  </section>
</main>
<script nonce="__NONCE__">
(function () {
  var token = new URLSearchParams(location.hash.slice(1)).get('token');
  // Out of the address bar and the history once read.
  history.replaceState(null, '', location.pathname);
  var show = function (id) {
    ['form-view', 'done-view', 'invalid-view'].forEach(function (v) {
      document.getElementById(v).hidden = v !== id;
    });
  };
  if (!token) { show('invalid-view'); return; }
  document.getElementById('open-app').href = 'inova://reset?token=' + encodeURIComponent(token);
  show('form-view');

  var form = document.getElementById('form');
  var error = document.getElementById('error');
  var submit = document.getElementById('submit');
  var fail = function (text) { error.textContent = text; error.hidden = false; };
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    error.hidden = true;
    var password = document.getElementById('password').value;
    if (password.length < 8) return fail('Паролата трябва да е поне 8 знака.');
    if (password !== document.getElementById('repeat').value) return fail('Паролите не съвпадат.');
    submit.disabled = true;
    fetch('recovery/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token, password: password })
    }).then(function (res) {
      if (res.status === 204) return show('done-view');
      if (res.status === 401) return show('invalid-view');
      if (res.status === 429) return fail('Твърде много опити. Опитайте отново след минута.');
      fail('Паролата не беше приета. Опитайте с друга.');
    }).catch(function () {
      fail('Няма връзка. Опитайте отново.');
    }).finally(function () { submit.disabled = false; });
  });
})();
</script>
</body>
</html>
`;

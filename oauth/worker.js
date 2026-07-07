/**
 * Decap CMS OAuth Proxy for Cloudflare Workers
 *
 * 部署后获取 Worker URL（如 https://dolephi-oauth.你的子域.workers.dev）
 * 将此 URL 填入 admin/config.yml 的 base_url 字段
 *
 * 环境变量（在 Cloudflare Dashboard 或 wrangler.toml 中设置）：
 *   GITHUB_CLIENT_ID     - GitHub OAuth App 的 Client ID
 *   GITHUB_CLIENT_SECRET - GitHub OAuth App 的 Client Secret
 *   CMS_URL              - CMS 后台地址（如 https://dolephi.pages.dev/admin/）
 */

const HTML_PREFIX = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>';

const ALLOWED_ROUTES = ['/auth', '/callback'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = url.origin;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // ---------- /auth : 重定向到 GitHub 授权页面 ----------
    if (url.pathname === '/auth') {
      const state = crypto.randomUUID();
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: `${origin}/callback`,
        scope: 'repo,user',
        state: state,
      });
      return Response.redirect(
        `https://github.com/login/oauth/authorize?${params.toString()}`,
        302
      );
    }

    // ---------- /callback : GitHub 回调，换取 access_token ----------
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      // 用户拒绝授权
      if (error) {
        return new Response(
          HTML_PREFIX +
            `window.opener.postMessage({error:'${error}'},'*');` +
            '</script></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      }

      if (!code) {
        return new Response('Missing code parameter', { status: 400 });
      }

      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
        return new Response(
          'OAuth environment variables not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Cloudflare Dashboard.',
          { status: 500 }
        );
      }

      // 向 GitHub 换取 access_token
      let tokenData;
      try {
        const tokenResp = await fetch(
          'https://github.com/login/oauth/access_token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              client_id: env.GITHUB_CLIENT_ID,
              client_secret: env.GITHUB_CLIENT_SECRET,
              code: code,
              redirect_uri: `${origin}/callback`,
            }),
          }
        );
        tokenData = await tokenResp.json();
      } catch (e) {
        return new Response('Failed to fetch token from GitHub: ' + e.message, {
          status: 502,
        });
      }

      if (tokenData.error) {
        return new Response(
          HTML_PREFIX +
            `window.opener.postMessage({error:'${tokenData.error}',error_description:'${tokenData.error_description || ''}'},'*');` +
            '</script></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      }

      // 成功获取 token，传回 CMS
      const cmsUrl = (env.CMS_URL || 'https://dolephi.zousenzhong.workers.dev/admin/').replace(/\/$/, '') + '/';
      const cmsOrigin = new URL(cmsUrl).origin; // postMessage 只需要 origin
      const token = tokenData.access_token;
      // Decap CMS popup 模式期望收到 { token: '...' } 对象
      const tokenPayload = JSON.stringify({ token });
      const safeCmsUrl = cmsUrl.replace(/'/g, "\\'");
      const safeCmsOrigin = cmsOrigin.replace(/'/g, "\\'");
      const safeTokenPayload = tokenPayload.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
      const safeToken = token.replace(/'/g, "\\'");

      const html =
        '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#E6F4EA;color:#256B43;flex-direction:column}</style></head><body><p>Completing login...</p><script>' +
        // 兼容性处理：确保 window.location 跳转兜底一定会执行
        `var cmsUrl='${safeCmsUrl}';` +
        `var cmsOrigin='${safeCmsOrigin}';` +
        // Popup 模式：通过 postMessage 把 token 传回 CMS 父窗口
        `try{` +
        `  if(window.opener && window.opener !== window){` +
        `    window.opener.postMessage(${safeTokenPayload}, cmsOrigin);` +
        `    window.opener.focus();` +
        `    window.close();` +
        `  }` +
        `}catch(e){console.error('postMessage failed', e);}` +
        // 当前窗口模式：把 token 放进 URL hash 后跳回 CMS
        `try{` +
        `  window.location.replace(cmsUrl + '#access_token=${safeToken}');` +
        `}catch(e){console.error('redirect failed', e);}` +
        // 最终兜底：无论前面是否成功，300ms 后强制跳转
        `setTimeout(function(){window.location.href = cmsUrl;}, 300);` +
        '</script></body></html>';

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    // ---------- 根路径：健康检查 ----------
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(
        'Dolephi OAuth Proxy is running.\n\nEndpoints:\n  /auth      - Start GitHub OAuth flow\n  /callback  - Handle GitHub callback\n\nConfigure in admin/config.yml:\n  base_url: ' +
          origin,
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      );
    }

    return new Response('Not Found', { status: 404 });
  },
};

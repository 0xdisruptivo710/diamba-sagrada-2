/* ============================================================================
   FUNÇÃO SERVERLESS (Vercel) — Envio dos formulários do site por e-mail (Resend)
   ----------------------------------------------------------------------------
   Recebe o mesmo payload JSON que o site já enviava ao webhook e envia um
   e-mail formatado via Resend (https://resend.com).

   A chave da API NUNCA fica no código. Configure no Vercel (Settings →
   Environment Variables):
     - RESEND_API_KEY  (obrigatória)  ex.: re_xxxxxxxxx
     - RESEND_TO       (opcional)     destino. Padrão abaixo.
     - RESEND_FROM     (opcional)     remetente. Precisa de domínio verificado
                                      no Resend; sem isso use onboarding@resend.dev.

   Sem dependências externas: usa o fetch nativo do Node 18+.
   ========================================================================== */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Nomes amigáveis por id de formulário (cai no prettify se não estiver aqui).
const FORM_LABELS = {
  'membership-form': 'Seja Associado',
  'contact-form': 'Contato',
  'receita-form': 'Envio de Receita Médica',
};

function readRawBody(req) {
  return new Promise(function (resolve, reject) {
    let raw = '';
    req.on('data', function (chunk) { raw += chunk; });
    req.on('end', function () { resolve(raw); });
    req.on('error', reject);
  });
}

async function parseBody(req) {
  // O Vercel costuma popular req.body em JSON; o resto é fallback robusto.
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    return JSON.parse(req.body);
  }
  const raw = await readRawBody(req);
  return raw ? JSON.parse(raw) : {};
}

function prettifyKey(key) {
  return String(key)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isFileValue(v) {
  return v && typeof v === 'object' && typeof v.data === 'string' && v.name;
}

function formatValue(v) {
  if (v === true) return 'Sim';
  if (v === false) return 'Não';
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY não configurada no servidor.' });
  }

  const to = process.env.RESEND_TO || 'Diambasagradafitoterapicos@gmail.com';
  const from = process.env.RESEND_FROM || 'Diamba Sagrada <onboarding@resend.dev>';

  let payload;
  try {
    payload = await parseBody(req);
  } catch (err) {
    return res.status(400).json({ error: 'Corpo da requisição inválido.' });
  }

  const formId = payload.form || 'formulario';
  const formLabel = FORM_LABELS[formId] || prettifyKey(formId);
  const data = (payload.data && typeof payload.data === 'object') ? payload.data : {};

  const rows = [];
  const attachments = [];
  let replyTo = null;
  let nome = null;

  Object.keys(data).forEach(function (key) {
    const value = data[key];

    if (isFileValue(value)) {
      attachments.push({
        filename: value.name,
        content: value.data,            // base64
        content_type: value.type || undefined,
      });
      rows.push({ label: prettifyKey(key), value: '📎 ' + value.name + ' (em anexo)' });
      return;
    }

    rows.push({ label: prettifyKey(key), value: formatValue(value) });

    // Detecta o e-mail de quem preencheu para responder direto (reply-to).
    if (!replyTo && typeof value === 'string' && /\S+@\S+\.\S+/.test(value) && /mail|contato/i.test(key)) {
      replyTo = value.trim();
    }
    if (!nome && /nome|name/i.test(key) && typeof value === 'string' && value.trim()) {
      nome = value.trim();
    }
  });

  const subject = '[Diamba Sagrada] ' + formLabel + (nome ? ' — ' + nome : '');

  const rowsHtml = rows.map(function (r) {
    return '<tr>' +
      '<td style="padding:8px 12px;border:1px solid #e5e5e5;background:#f7f5f0;font-weight:600;vertical-align:top;white-space:nowrap;">' +
        escapeHtml(r.label) + '</td>' +
      '<td style="padding:8px 12px;border:1px solid #e5e5e5;">' +
        escapeHtml(r.value).replace(/\n/g, '<br>') + '</td>' +
    '</tr>';
  }).join('');

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#222;">' +
      '<h2 style="color:#2f6b3a;margin:0 0 4px;">Novo formulário: ' + escapeHtml(formLabel) + '</h2>' +
      '<p style="color:#777;font-size:13px;margin:0 0 16px;">Recebido pelo site ' +
        escapeHtml(payload.url || 'diambasagrada.com') + '</p>' +
      '<table style="border-collapse:collapse;width:100%;font-size:14px;">' + rowsHtml + '</table>' +
      (attachments.length
        ? '<p style="color:#777;font-size:13px;margin-top:16px;">' + attachments.length + ' anexo(s) incluído(s).</p>'
        : '') +
      '<p style="color:#aaa;font-size:12px;margin-top:24px;">Enviado automaticamente em ' +
        escapeHtml(payload.submittedAt || '') + '</p>' +
    '</div>';

  const text =
    'Novo formulário: ' + formLabel + '\n' +
    'Site: ' + (payload.url || '') + '\n\n' +
    rows.map(function (r) { return r.label + ': ' + r.value; }).join('\n') +
    '\n\nEnviado em ' + (payload.submittedAt || '');

  const emailBody = {
    from: from,
    to: [to],
    subject: subject,
    html: html,
    text: text,
  };
  if (replyTo) emailBody.reply_to = replyTo;
  if (attachments.length) emailBody.attachments = attachments;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    });

    const result = await response.json().catch(function () { return {}; });

    if (!response.ok) {
      console.error('Resend respondeu', response.status, result);
      return res.status(502).json({
        error: 'Falha ao enviar o e-mail.',
        detail: result && result.message ? result.message : null,
      });
    }

    return res.status(200).json({ ok: true, id: result.id || null });
  } catch (err) {
    console.error('Erro ao chamar o Resend:', err);
    return res.status(502).json({ error: 'Erro de comunicação com o serviço de e-mail.' });
  }
};

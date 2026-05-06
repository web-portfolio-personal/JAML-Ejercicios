/**
 * Logger Service — envía errores 5XX a un canal de Slack via Incoming Webhook.
 */

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;

/**
 * Envía un mensaje de error al canal de Slack.
 * No lanza excepciones: si falla el envío, solo loguea en consola.
 */
/* c8 ignore next */ /* istanbul ignore next -- Requiere SLACK_WEBHOOK_URL, no disponible en tests */
export const slackError = async ({ method, path, message, stack, statusCode }) => {
  if (!SLACK_WEBHOOK || process.env.NODE_ENV === 'test') return;

  const text = [
    `🚨 *Error ${statusCode} en BildyApp API*`,
    `• *Ruta:* \`${method} ${path}\``,
    `• *Mensaje:* ${message}`,
    `• *Timestamp:* ${new Date().toISOString()}`,
    stack ? `• *Stack:*\n\`\`\`${stack.slice(0, 800)}\`\`\`` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await fetch(SLACK_WEBHOOK, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });
  } catch (err) {
    console.error('⚠️  Error enviando log a Slack:', err.message);
  }
};

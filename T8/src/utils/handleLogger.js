import { IncomingWebhook } from '@slack/webhook';

const webhook = process.env.SLACK_WEBHOOK
  ? new IncomingWebhook(process.env.SLACK_WEBHOOK)
  : null;

export const loggerStream = {
  write: (message) => {
    if (webhook) {
      webhook.send({
        text: `🚨 *Error en API*\n\`\`\`${message}\`\`\``
      }).catch(err => console.error('Error enviando a Slack:', err));
    }
    console.error(message);
  }
};

export const sendSlackNotification = async (text) => {
  if (webhook) {
    try {
      await webhook.send({ text });
    } catch (err) {
      console.error('Error enviando a Slack:', err);
    }
  }
};

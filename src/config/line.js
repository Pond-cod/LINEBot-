const { Client, middleware } = require('@line/bot-sdk');
require('dotenv').config();

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
};

let lineClient = null;
let lineMiddleware = null;

if (lineConfig.channelAccessToken) {
  try {
    lineClient = new Client(lineConfig);
  } catch (err) {
    console.error('❌ Failed to initialize LINE Client:', err.message);
  }
} else {
  console.warn('⚠️ Warning: LINE_CHANNEL_ACCESS_TOKEN is not set. LINE push/reply will be disabled or mocked.');
}

if (lineConfig.channelSecret) {
  try {
    lineMiddleware = middleware(lineConfig);
  } catch (err) {
    console.error('❌ Failed to initialize LINE Middleware:', err.message);
  }
} else {
  console.warn('⚠️ Warning: LINE_CHANNEL_SECRET is not set. LINE Webhook verification will be disabled.');
}

module.exports = {
  lineConfig,
  lineClient,
  lineMiddleware
};


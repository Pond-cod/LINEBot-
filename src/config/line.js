const { Client, middleware } = require('@line/bot-sdk');
require('dotenv').config();

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
};

const lineClient = new Client(lineConfig);
const lineMiddleware = middleware(lineConfig);

module.exports = {
  lineConfig,
  lineClient,
  lineMiddleware
};

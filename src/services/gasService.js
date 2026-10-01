/**
 * Service สำหรับเรียกใช้งาน Google Apps Script Web App (GAS)
 */

async function callGas(action, payload = {}, retries = 2) {
  const gasUrl = process.env.GAS_WEBAPP_URL;
  if (!gasUrl) {
    throw new Error('GAS_WEBAPP_URL is not set in .env');
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          ...payload
        }),
        redirect: 'follow'
      });

      const text = await response.text();
      let json = null;

      try {
        json = JSON.parse(text);
      } catch (e) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 600));
          continue;
        }
        throw new Error('Invalid JSON from GAS: ' + text.slice(0, 100));
      }

      // ป้องกันกรณี Apps Script สลับไปเรียก doGet ตอนติด Redirect
      if (json.status === 'online' && json.success === undefined) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 600));
          continue;
        }
      }

      if (!json.success) {
        throw new Error(json.error || 'GAS operation failed');
      }

      return json.data;
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 600));
        continue;
      }
      throw err;
    }
  }
}

function isGasConfigured() {
  return Boolean(process.env.GAS_WEBAPP_URL && process.env.GAS_WEBAPP_URL.startsWith('http'));
}

module.exports = {
  callGas,
  isGasConfigured
};

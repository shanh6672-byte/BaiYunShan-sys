const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const CERT_DIR = path.join(__dirname, 'certs');
const KEY_PATH = path.join(CERT_DIR, 'server.key');
const CERT_PATH = path.join(CERT_DIR, 'server.crt');

function generateCert() {
  if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

  // 如果已有证书则直接返回
  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    return {
      key: fs.readFileSync(KEY_PATH, 'utf8'),
      cert: fs.readFileSync(CERT_PATH, 'utf8')
    };
  }

  console.log('正在生成自签名证书...');
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + Date.now().toString(16);

  const now = new Date();
  cert.validity.notBefore = now;
  cert.validity.notAfter = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  const attrs = [
    { name: 'commonName', value: 'localhost' },
    { name: 'organizationName', value: 'Forest Patrol Dev' }
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'subjectAltName', altNames: [
      { type: 2, value: 'localhost' },  // DNS
      { type: 7, ip: '127.0.0.1' }      // IP
    ]}
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  const pemKey = forge.pki.privateKeyToPem(keys.privateKey);
  const pemCert = forge.pki.certificateToPem(cert);

  fs.writeFileSync(KEY_PATH, pemKey);
  fs.writeFileSync(CERT_PATH, pemCert);

  console.log('证书已生成: ' + CERT_DIR);
  return { key: pemKey, cert: pemCert };
}

module.exports = { generateCert };

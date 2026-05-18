const crypto = require('crypto');
const config = require('../config');

const STATIC_KICK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`;

async function getKickPublicKey() {
  try {
    const res = await fetch('https://api.kick.com/public/v1/public-key');
    if (!res.ok) return STATIC_KICK_PUBLIC_KEY;
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return json?.data?.public_key || json?.public_key || STATIC_KICK_PUBLIC_KEY;
    } catch {
      return text.includes('BEGIN PUBLIC KEY') ? text : STATIC_KICK_PUBLIC_KEY;
    }
  } catch {
    return STATIC_KICK_PUBLIC_KEY;
  }
}

async function verifyKickRequest(headers, rawBodyBuffer) {
  if (!config.kickVerifySignature) return true;

  const messageId = headers['kick-event-message-id'];
  const timestamp = headers['kick-event-message-timestamp'];
  const signature = headers['kick-event-signature'];

  if (!messageId || !timestamp || !signature) return false;

  const publicKey = await getKickPublicKey();
  const rawBody = rawBodyBuffer.toString('utf8');
  const signedPayload = `${messageId}.${timestamp}.${rawBody}`;

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(signedPayload);
  verifier.end();

  try {
    return verifier.verify(publicKey, signature, 'base64');
  } catch {
    return false;
  }
}

module.exports = { verifyKickRequest };

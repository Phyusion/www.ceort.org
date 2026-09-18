#!/usr/bin/env node
/*
 * protect-page.js — encrypt (or decrypt) the content of a password-protected page.
 *
 * The published page (e.g. members-only.html) ships only an encrypted payload.
 * The browser derives a key from the visitor's password (PBKDF2-SHA256) and
 * decrypts the content with AES-256-GCM. Nothing readable is ever committed.
 *
 * Usage:
 *   node tools/protect-page.js encrypt <content.html> <page.html> [--key-from <other-page.html>]
 *   node tools/protect-page.js decrypt <page.html> <content.html>
 *
 * --key-from reuses the salt of an already-encrypted page, so that (with the
 * same password) unlocking either page in a browser tab also unlocks the other.
 *
 * The password is read from the PAGE_PASSWORD environment variable, or
 * prompted for interactively (input hidden) when that variable is unset.
 *
 * Requires Node 18+. No dependencies.
 */

'use strict';

const fs = require('fs');
const crypto = require('crypto');
const readline = require('readline');

const KDF_ITERATIONS = 600000;
const PAYLOAD_RE = /(<script type="application\/json" id="protected-payload">)([\s\S]*?)(<\/script>)/;

function usage(message) {
  if (message) console.error('Error: ' + message + '\n');
  console.error('Usage:\n  node tools/protect-page.js encrypt <content.html> <page.html> [--key-from <other-page.html>]\n  node tools/protect-page.js decrypt <page.html> <content.html>');
  process.exit(1);
}

function readPassword(promptText) {
  if (process.env.PAGE_PASSWORD) return Promise.resolve(process.env.PAGE_PASSWORD);
  return new Promise(function (resolve) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const stdoutWrite = rl._writeToOutput;
    rl._writeToOutput = function (chunk) {
      // Echo the prompt itself, hide typed characters.
      if (chunk.indexOf(promptText) === 0) stdoutWrite.call(rl, promptText);
    };
    rl.question(promptText, function (answer) {
      rl._writeToOutput = stdoutWrite;
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(Buffer.from(password, 'utf8'), salt, KDF_ITERATIONS, 32, 'sha256');
}

function encrypt(plaintext, password, salt) {
  salt = salt || crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    kdf: 'PBKDF2-SHA256',
    iter: KDF_ITERATIONS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    ct: Buffer.concat([body, tag]).toString('base64')
  };
}

function decrypt(payload, password) {
  const salt = Buffer.from(payload.salt, 'base64');
  const iv = Buffer.from(payload.iv, 'base64');
  const data = Buffer.from(payload.ct, 'base64');
  const body = data.subarray(0, data.length - 16);
  const tag = data.subarray(data.length - 16);
  const key = crypto.pbkdf2Sync(Buffer.from(password, 'utf8'), salt, payload.iter, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

async function main() {
  const args = process.argv.slice(2);
  let keyFrom = null;
  const flag = args.indexOf('--key-from');
  if (flag !== -1) {
    keyFrom = args[flag + 1];
    if (!keyFrom) usage('--key-from needs a page file');
    args.splice(flag, 2);
  }
  const [command, input, output] = args;
  if (!command || !input || !output) usage();

  if (command === 'encrypt') {
    if (!fs.existsSync(input)) usage('content file not found: ' + input);
    if (!fs.existsSync(output)) usage('page file not found: ' + output);
    const page = fs.readFileSync(output, 'utf8');
    if (!PAYLOAD_RE.test(page)) usage(output + ' has no <script type="application/json" id="protected-payload"> element');

    const password = await readPassword('Password for ' + output + ': ');
    if (password.length < 8) usage('password must be at least 8 characters');
    if (!process.env.PAGE_PASSWORD) {
      const confirm = await readPassword('Confirm password: ');
      if (confirm !== password) usage('passwords do not match');
    }

    let salt = null;
    if (keyFrom) {
      if (!fs.existsSync(keyFrom)) usage('--key-from page not found: ' + keyFrom);
      const other = fs.readFileSync(keyFrom, 'utf8').match(PAYLOAD_RE);
      if (!other || !other[2].trim()) usage(keyFrom + ' has no encrypted payload to take the key from');
      salt = Buffer.from(JSON.parse(other[2]).salt, 'base64');
    }

    const content = fs.readFileSync(input, 'utf8');
    const payload = JSON.stringify(encrypt(content, password, salt));
    fs.writeFileSync(output, page.replace(PAYLOAD_RE, '$1' + payload + '$3'));
    console.log('Encrypted ' + input + ' into ' + output + ' (' + content.length + ' chars).');
    return;
  }

  if (command === 'decrypt') {
    if (!fs.existsSync(input)) usage('page file not found: ' + input);
    const match = fs.readFileSync(input, 'utf8').match(PAYLOAD_RE);
    if (!match || !match[2].trim()) usage(input + ' has no encrypted payload');
    const password = await readPassword('Password for ' + input + ': ');
    let content;
    try {
      content = decrypt(JSON.parse(match[2]), password);
    } catch (err) {
      usage('wrong password (or the payload is corrupted)');
    }
    fs.writeFileSync(output, content);
    console.log('Decrypted ' + input + ' into ' + output + '. This file is git-ignored; do not commit it.');
    return;
  }

  usage('unknown command: ' + command);
}

main().catch(function (err) {
  console.error(err.message);
  process.exit(1);
});

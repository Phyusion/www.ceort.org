// ===== Password-Protected Page =====
// The page ships only an AES-256-GCM encrypted payload. The password entered by
// the visitor is run through PBKDF2-SHA256 to derive the key, then the content
// is decrypted in the browser and injected into the page. A wrong password
// simply fails authentication; nothing readable exists in the page source.
(function() {
  var payloadEl = document.getElementById('protected-payload');
  var form = document.getElementById('unlockForm');
  var input = document.getElementById('unlockPassword');
  var button = document.getElementById('unlockButton');
  var error = document.getElementById('unlockError');
  var gate = document.getElementById('protectedGate');
  var content = document.getElementById('protectedContent');
  var lockButton = document.getElementById('lockButton');
  if (!payloadEl || !form || !input || !gate || !content) return;

  var payload;
  try {
    payload = JSON.parse(payloadEl.textContent);
  } catch (e) {
    payload = null;
  }

  if (!payload || !payload.ct) {
    showError('This page has not been set up yet.');
    input.disabled = true;
    button.disabled = true;
    return;
  }

  if (!window.crypto || !window.crypto.subtle) {
    showError('Your browser does not support the encryption needed to view this page. Please use a current browser over https.');
    input.disabled = true;
    button.disabled = true;
    return;
  }

  var storageKey = 'protected-page:' + payload.salt;

  function fromBase64(str) {
    var bin = atob(str);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function toBase64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function showError(message) {
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  }

  function hideError() {
    if (!error) return;
    error.hidden = true;
  }

  function setBusy(busy) {
    input.disabled = busy;
    button.disabled = busy;
    button.textContent = busy ? 'Unlocking…' : 'Unlock';
  }

  function deriveKey(password) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function(baseKey) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: fromBase64(payload.salt), iterations: payload.iter, hash: 'SHA-256' },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          true,
          ['decrypt']
        );
      });
  }

  function decryptWith(key) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(payload.iv) }, key, fromBase64(payload.ct))
      .then(function(buffer) {
        return new TextDecoder().decode(buffer);
      });
  }

  function reveal(html) {
    content.innerHTML = html;
    content.hidden = false;
    gate.hidden = true;
    if (lockButton) lockButton.hidden = false;
    document.body.classList.add('protected-unlocked');
    // Animate any fade-in blocks inside the revealed content.
    var blocks = content.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right');
    for (var i = 0; i < blocks.length; i++) blocks[i].classList.add('visible');
    // Scripts inserted via innerHTML do not run; re-create them so interactive
    // content (charts, filters) initialises. Runs after the content is visible
    // so layout measurements are correct.
    var scripts = content.querySelectorAll('script');
    for (var j = 0; j < scripts.length; j++) {
      var s = document.createElement('script');
      for (var k = 0; k < scripts[j].attributes.length; k++) {
        s.setAttribute(scripts[j].attributes[k].name, scripts[j].attributes[k].value);
      }
      s.textContent = scripts[j].textContent;
      scripts[j].parentNode.replaceChild(s, scripts[j]);
    }
  }

  function remember(key) {
    try {
      return crypto.subtle.exportKey('raw', key).then(function(raw) {
        sessionStorage.setItem(storageKey, toBase64(new Uint8Array(raw)));
      });
    } catch (e) {
      return Promise.resolve();
    }
  }

  function forget() {
    try { sessionStorage.removeItem(storageKey); } catch (e) {}
  }

  // Re-open automatically within the same browser tab (the key lives in
  // sessionStorage, which is cleared when the tab is closed).
  (function restore() {
    var stored = null;
    try { stored = sessionStorage.getItem(storageKey); } catch (e) {}
    if (!stored) return;
    crypto.subtle.importKey('raw', fromBase64(stored), { name: 'AES-GCM' }, true, ['decrypt'])
      .then(decryptWith)
      .then(reveal)
      .catch(forget);
  })();

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var password = input.value;
    if (!password) return;
    hideError();
    setBusy(true);
    var derived;
    deriveKey(password)
      .then(function(key) { derived = key; return decryptWith(key); })
      .then(function(html) {
        setBusy(false);
        input.value = '';
        reveal(html);
        return remember(derived);
      })
      .catch(function() {
        setBusy(false);
        showError('That password is not correct. Please try again.');
        input.focus();
        input.select();
      });
  });

  if (lockButton) {
    lockButton.addEventListener('click', function() {
      forget();
      content.innerHTML = '';
      content.hidden = true;
      gate.hidden = false;
      lockButton.hidden = true;
      document.body.classList.remove('protected-unlocked');
      hideError();
      input.focus();
    });
  }
})();

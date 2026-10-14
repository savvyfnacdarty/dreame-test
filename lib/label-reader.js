/* Lecture d'une étiquette (photo) : modèle, IMEI 1 / IMEI 2, N° de série.
   1) codes-barres / QR (si le navigateur sait les lire)  2) OCR (Tesseract.js, chargé à la demande).
   Ne remplace jamais une case déjà remplie : les autres valeurs lues sont proposées sous forme de pastilles. */
(function (w) {
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- analyse du texte lu ---------- */
  function luhn(s) { var sum = 0, alt = false, i, n; for (i = s.length - 1; i >= 0; i--) { n = +s.charAt(i); if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; } return sum % 10 === 0; }

  function parseImeis(t) {
    var out = [], seen = {}, m;
    function add(raw, slot) {
      var d = raw.replace(/\D/g, "");
      if (d.length !== 15 || seen[d]) return;
      seen[d] = 1; out.push({ v: d, ok: luhn(d), slot: slot || 0 });
    }
    var re = /IMEI\s*(?:\/\s*MEID)?\s*([12])?\s*[:#.\-\/]*\s*((?:\d[ \-]?){15})/gi;
    while ((m = re.exec(t))) add(m[2], m[1] ? +m[1] : 0);
    var re2 = /(?:^|[^\d])((?:\d[ \-]?){14}\d)(?=[^\d]|$)/g;
    while ((m = re2.exec(t))) add(m[1], 0);
    return out;
  }

  var STOP = /^(IMEI|IMEI1|IMEI2|MEID|EID|SERIAL|S\/N|SN|N°|NO|FCC|FCCID|ID|MADE|IN|CE|DATE|INPUT|OUTPUT|RATED|AC|DC|V|W|HZ|BATTERY|CAPACITY|COLOR|COLOUR|STORAGE|EAN|UPC|SKU|PN|P\/N|FNAC|DARTY)$/;
  function parseModels(t) {
    var out = [], seen = {}, m;
    function add(s, w) {
      s = (s || "").replace(/\s+/g, " ").trim().replace(/[.,;:\-\/]+$/, "");
      if (s.length < 3 || s.length > 34 || seen[s] || /^\d+$/.test(s)) return;
      seen[s] = 1; out.push({ v: s, w: w });
    }
    var U = t.toUpperCase().replace(/[|]/g, " ");
    var mk = [
      /\bIPHONE\s*(?:SE|XR|XS\s*MAX|XS|X|\d{1,2})(?:\s*(?:PRO\s*MAX|PRO|PLUS|MINI|E))?\b/g,
      /\bGALAXY\s+[A-Z]{1,2}\d{1,3}(?:\s*(?:ULTRA|PLUS|\+|FE|5G))*\b/g,
      /\bPIXEL\s*\d{1,2}[A-Z]?(?:\s*(?:PRO\s*XL|PRO|XL|A))?\b/g
    ];
    function pretty(x) {
      return x.split(/\s+/).map(function (t) {
        if (t === "IPHONE") return "iPhone";
        if (/^(GALAXY|PIXEL|PRO|MAX|ULTRA|PLUS|MINI)$/.test(t)) return t.charAt(0) + t.slice(1).toLowerCase();
        return t;
      }).join(" ").replace(/^iPhone(\d)/, "iPhone $1");
    }
    mk.forEach(function (r) { while ((m = r.exec(U))) add(pretty(m[0]), 3); });
    var re = /(?:MOD[ÈE]LE?|MODEL(?:\s*(?:NO|NUMBER|NAME))?|MOD\.|TYPE|PRODUCT\s*NAME|PRODUIT|R[ÉE]F(?:[ÉE]RENCE)?\.?|ARTICLE)\s*(?:N°|NO\.?|#)?\s*[:#=.\-]?\s*([A-Z0-9][A-Z0-9\-\/\.\+]{1,}(?: [A-Z0-9][A-Z0-9\-\/\.\+]{0,}){0,2})/g;
    while ((m = re.exec(U))) {
      var toks = m[1].split(" "), keep = [], i;
      for (i = 0; i < toks.length; i++) { if (STOP.test(toks[i]) || toks[i].length > 16) break; keep.push(toks[i]); }
      if (keep.length) add(keep.join(" "), 2);
    }
    var sm = /\bSM-[A-Z]\d{3,4}[A-Z]{0,2}(?:\/[A-Z]{1,3})?\b/g;
    while ((m = sm.exec(U))) add(m[0], 2);
    out.sort(function (a, b) { return b.w - a.w; });
    return out;
  }

  function parseSerials(t, exclude) {
    var out = [], seen = {};
    function add(s) {
      s = (s || "").toUpperCase().replace(/^[-.]+|[-.]+$/g, "");
      if (s.length < 6 || s.length > 28 || seen[s] || exclude[s]) return;
      if (/^\d{15}$/.test(s) && luhn(s)) return;
      seen[s] = 1; out.push(s);
    }
    var re = /(?:S\s*\/?\s*N|SERIAL(?:\s*(?:NO|NUMBER|N°))?|N\s*°?\s*DE\s*S[ÉE]RIE|SERIE)\s*[:#.\-]?\s*([A-Z0-9][A-Z0-9\-]{5,})/gi, m;
    while ((m = re.exec(t))) add(m[1]);
    (t.toUpperCase().match(/[A-Z0-9][A-Z0-9\-]{7,}/g) || []).forEach(function (x) {
      if (/\d/.test(x) && (/[A-Z]/.test(x) || x.length >= 10)) add(x);
    });
    return out;
  }

  function parse(text) {
    var imeis = parseImeis(text), models = parseModels(text), ex = {};
    models.forEach(function (x) { ex[x.v.replace(/ /g, "")] = 1; ex[x.v] = 1; x.v.split("/").forEach(function (q) { ex[q] = 1; }); });
    imeis.forEach(function (x) { ex[x.v] = 1; });
    return { imeis: imeis, models: models, serials: parseSerials(text, ex) };
  }

  /* ---------- lecture de l'image ---------- */
  function canvasOf(im, max, gray) {
    var s = Math.min(1, max / Math.max(im.naturalWidth || im.width, im.naturalHeight || im.height)), c = document.createElement("canvas");
    c.width = Math.round((im.naturalWidth || im.width) * s); c.height = Math.round((im.naturalHeight || im.height) * s);
    var x = c.getContext("2d"); x.drawImage(im, 0, 0, c.width, c.height);
    if (gray) {
      var d = x.getImageData(0, 0, c.width, c.height), p = d.data, i, g;
      for (i = 0; i < p.length; i += 4) { g = .299 * p[i] + .587 * p[i + 1] + .114 * p[i + 2]; g = Math.max(0, Math.min(255, (g - 128) * 1.5 + 128)); p[i] = p[i + 1] = p[i + 2] = g; }
      x.putImageData(d, 0, 0);
    }
    return c;
  }
  function loadTess() {
    return new Promise(function (res, rej) {
      if (w.Tesseract) return res();
      var s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.0/tesseract.min.js";
      s.onload = res; s.onerror = function () { rej(new Error("offline")); }; document.head.appendChild(s);
    });
  }
  function readCodes(im) {
    var vals = [], p = Promise.resolve();
    if ("BarcodeDetector" in w) {
      p = new BarcodeDetector().detect(im).then(function (r) { r.forEach(function (x) { if (x.rawValue) vals.push(x.rawValue); }); }).catch(function () {});
    }
    return p.then(function () {
      if (vals.length || typeof w.qrFromImg !== "function") return;
      return w.qrFromImg(im).then(function (v) { if (v) vals.push(v); });
    }).then(function () { return vals; });
  }

  /* ---------- affichage / remplissage ---------- */
  function box() { return $("snRes"); }
  function say(msg, err) { var b = box(); if (!b) return; b.innerHTML = ""; var s = document.createElement("span"); s.className = err ? "err" : ""; s.textContent = msg; b.appendChild(s); }
  function mdl() { return $("mdlInp"); }
  function setIfEmpty(el, v) { if (el && !el.value && v) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); return true; } return false; }
  function chip(label, fn) {
    var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = label;
    b.onclick = function () { fn(); }; return b;
  }
  function setImei(v) { var a = $("imei1"), b = $("imei2"); if (!a) return; if (a.value === v || (b && b.value === v)) return; if (!a.value) a.value = v; else if (b && !b.value) b.value = v; else a.value = v; }

  function show(res, filled) {
    var b = box(); if (!b) return; b.innerHTML = "";
    var parts = [];
    if (filled.model) parts.push("modèle " + filled.model);
    if (filled.imei1) parts.push("IMEI 1 " + filled.imei1);
    if (filled.imei2) parts.push("IMEI 2 " + filled.imei2);
    if (filled.sn) parts.push("N° de série " + filled.sn);
    var head = document.createElement("span");
    head.textContent = (parts.length ? "Lu : " + parts.join(" · ") + " — vérifiez les valeurs. " : "Les champs déjà remplis ne sont pas modifiés. Valeurs lues, à choisir si besoin : ");
    b.appendChild(head);
    var n = 0;
    res.models.forEach(function (x) { if (n < 6 && x.v !== filled.model) { n++; b.appendChild(chip("Modèle : " + x.v, function () { if (mdl()) mdl().value = x.v; })); } });
    if ($("imei1")) res.imeis.forEach(function (x) { if (x.v !== filled.imei1 && x.v !== filled.imei2) b.appendChild(chip("IMEI" + (x.ok ? "" : " ⚠") + " : " + x.v, function () { setImei(x.v); })); });
    res.serials.slice(0, 6).forEach(function (s) { if (s !== filled.sn) b.appendChild(chip("N° série : " + s, function () { var i = $("snInp"); if (i) i.value = s; })); });
    if (res.imeis.some(function (x) { return !x.ok; })) { var w2 = document.createElement("div"); w2.className = "err"; w2.textContent = "⚠ IMEI dont la clé de contrôle est invalide : probablement un chiffre mal lu, à vérifier sur l'étiquette (ou *#06#)."; b.appendChild(w2); }
  }

  function apply(res) {
    var filled = {}, sn = $("snInp"), good = res.imeis.filter(function (x) { return x.ok; });
    var s1 = good.filter(function (x) { return x.slot === 1; })[0], s2 = good.filter(function (x) { return x.slot === 2; })[0];
    var rest = good.filter(function (x) { return x !== s1 && x !== s2; });
    var i1 = s1 || rest.shift(), i2 = s2 || rest.shift();
    if ($("imei1") && i1 && setIfEmpty($("imei1"), i1.v)) filled.imei1 = i1.v;
    if ($("imei2") && i2 && setIfEmpty($("imei2"), i2.v)) filled.imei2 = i2.v;
    if (mdl() && res.models[0] && setIfEmpty(mdl(), res.models[0].v)) filled.model = res.models[0].v;
    if (sn && res.serials[0] && setIfEmpty(sn, res.serials[0])) filled.sn = res.serials[0];
    show(res, filled);
    return filled;
  }

  /* im : élément <img> / canvas déjà chargé */
  function run(im) {
    say("Lecture de l'étiquette (codes puis texte)…");
    var codes = [], text = "";
    return readCodes(im).then(function (vals) { codes = vals; }).then(function () {
      say("Lecture du texte de l'étiquette (quelques secondes)…");
      return loadTess().then(function () { return w.Tesseract.recognize(canvasOf(im, 2000, true), "eng"); })
        .then(function (r) { text = (r && r.data && r.data.text) || ""; }, function () { return "noocr"; });
    }).then(function (flag) {
      var all = text, extra = [];
      codes.forEach(function (v) {
        v = String(v).trim();
        var digits = v.replace(/\D/g, "");
        if (/^\d{15}$/.test(digits) && luhn(digits)) all += "\nIMEI " + digits + "\n";
        else if (typeof w.snFromQr === "function") { var sn = w.snFromQr(v); if (sn) extra.push(sn); }
      });
      var res = parse(all);
      extra.forEach(function (s) { if (res.serials.indexOf(s) < 0) res.serials.unshift(s); });
      if (!res.imeis.length && !res.models.length && !res.serials.length) {
        say(flag === "noocr" ? "Lecture du texte indisponible (connexion requise) : saisissez les valeurs à la main, la photo de l'étiquette est jointe." : "Rien de lisible : rapprochez-vous, évitez les reflets, ou saisissez à la main (IMEI : composer *#06#).", true);
        return null;
      }
      return apply(res);
    }).catch(function () { say("Image illisible.", true); });
  }

  w.LabelReader = { run: run, parse: parse, luhn: luhn };
})(typeof window !== "undefined" ? window : this);

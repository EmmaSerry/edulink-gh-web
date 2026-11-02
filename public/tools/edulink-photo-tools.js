/* EduLink GH - paid photo tools (shared by the Batch Photo Editor and the AI Photo Studio page).
 *  - __edGate(n, zipName): asks for the zip name, then makes sure the downloads are paid for.
 *  - AI Photo Studio: remove background / change colour / ready-made backgrounds.
 * Talks only to the Supabase Edge Function "photo-service". Prices are set in
 * Super Admin -> Photo editor and are always worked out on the server. */
(function () {
  "use strict";
  var API = "https://pltnwvjgalzquvutyqyz.supabase.co/functions/v1/photo-service";
  var TOKENS_KEY = "edulink_photo_tokens";
  var EMAIL_KEY = "edulink_photo_email";

  // ---------------------------------------------------------------- helpers
  function authHeader() {
    try {
      var s = JSON.parse(localStorage.getItem("edulink-gh-session") || "null");
      return s && s.access_token ? { Authorization: "Bearer " + s.access_token } : {};
    } catch (e) { return {}; }
  }
  function call(action, data) {
    return fetch(API, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeader()),
      body: JSON.stringify(Object.assign({ action: action }, data || {})),
    }).then(function (r) {
      return r.json().then(function (j) { j = j || {}; j._status = r.status; return j; });
    });
  }
  function tokens() {
    try { var t = JSON.parse(localStorage.getItem(TOKENS_KEY) || "[]"); return Array.isArray(t) ? t : []; }
    catch (e) { return []; }
  }
  function addToken(t) {
    var list = tokens().filter(function (x) { return x !== t; });
    list.unshift(t);
    localStorage.setItem(TOKENS_KEY, JSON.stringify(list.slice(0, 20)));
  }
  function money(n) { return "GHS " + Number(n).toFixed(2); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function safeName(s, fallback) {
    var n = String(s || "").replace(/[^\w\s.-]/g, "").trim().replace(/\s+/g, "-");
    return n || fallback;
  }
  function baseName(f) { return f.replace(/\.[^.]+$/, ""); }

  // ----------------------------------------------------------------- styles
  var css =
    ".edp-back{position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:14px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}" +
    ".edp-box{background:#fff;color:#0f172a;border-radius:14px;max-width:520px;width:100%;max-height:92vh;overflow:auto;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.35)}" +
    ".edp-box h2{margin:0 0 6px;font-size:20px}.edp-box p{margin:6px 0;font-size:14px;line-height:1.45;color:#334155}" +
    ".edp-row{display:flex;gap:8px;align-items:center;margin:10px 0;flex-wrap:wrap}" +
    ".edp-box input[type=email],.edp-box input[type=text],.edp-box input[type=number]{padding:9px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px;width:100%;box-sizing:border-box}" +
    ".edp-box input[type=number]{width:110px}" +
    ".edp-btn{border:0;border-radius:10px;padding:11px 18px;font-size:15px;font-weight:700;cursor:pointer;background:#0b6b4f;color:#fff}" +
    ".edp-btn.edp-alt{background:#e2e8f0;color:#0f172a}.edp-btn.edp-big{font-size:17px;padding:14px 22px}.edp-btn[disabled]{opacity:.5;cursor:default}" +
    ".edp-btn.edp-ai{background:linear-gradient(90deg,#7c3aed,#db2777);color:#fff}" +
    ".edp-total{font-size:22px;font-weight:800;margin:8px 0}.edp-note{font-size:12px;color:#64748b}" +
    ".edp-err{background:#fee2e2;color:#991b1b;border-radius:8px;padding:8px 10px;font-size:13px;margin:8px 0}" +
    ".edp-ok{background:#dcfce7;color:#166534;border-radius:8px;padding:8px 10px;font-size:13px;margin:8px 0}" +
    ".edp-ribbon{position:fixed;top:0;left:0;right:0;z-index:9998;background:linear-gradient(90deg,#6d28d9,#db2777,#f97316);color:#fff;display:flex;gap:14px;align-items:center;justify-content:center;padding:8px 12px;font:600 15px system-ui,sans-serif;flex-wrap:wrap;box-shadow:0 4px 14px rgba(0,0,0,.25)}" +
    ".edp-ribbon button{background:#fff;color:#6d28d9;border:0;border-radius:999px;padding:9px 20px;font-weight:800;font-size:15px;cursor:pointer;animation:edppulse 2s infinite}" +
    "@keyframes edppulse{0%{box-shadow:0 0 0 0 rgba(255,255,255,.8)}70%{box-shadow:0 0 0 14px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}" +
    ".edp-studio{position:fixed;inset:0;z-index:99998;background:#f1f5f9;color:#0f172a;overflow:auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}" +
    ".edp-studio.edp-page{position:static;min-height:100vh}" +
    ".edp-head{background:linear-gradient(90deg,#6d28d9,#db2777);color:#fff;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}" +
    ".edp-head h1{margin:0;font-size:22px}.edp-head a,.edp-head button{color:#fff;background:rgba(255,255,255,.18);border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;text-decoration:none;font-size:14px}" +
    ".edp-wrap{max-width:1020px;margin:0 auto;padding:16px}" +
    ".edp-card{background:#fff;border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:0 2px 10px rgba(15,23,42,.08)}" +
    ".edp-card h3{margin:0 0 10px;font-size:17px}" +
    ".edp-drop{border:3px dashed #a78bfa;border-radius:14px;padding:30px 14px;text-align:center;cursor:pointer;background:#faf5ff;font-size:17px;font-weight:700;color:#6d28d9}" +
    ".edp-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}" +
    ".edp-opt{border:2px solid #e2e8f0;border-radius:12px;padding:12px;cursor:pointer;background:#fff}" +
    ".edp-opt.edp-on{border-color:#7c3aed;background:#f5f3ff}.edp-opt b{display:block;font-size:16px;margin-bottom:3px}.edp-opt span{font-size:13px;color:#475569}" +
    ".edp-sw{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}" +
    ".edp-sw i{width:34px;height:34px;border-radius:8px;border:2px solid #cbd5e1;cursor:pointer;display:block}.edp-sw i.edp-on{border-color:#7c3aed;box-shadow:0 0 0 3px #ddd6fe}" +
    ".edp-two{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:14px}@media(max-width:760px){.edp-two{grid-template-columns:1fr}}" +
    ".edp-stage{background:repeating-conic-gradient(#e5e7eb 0% 25%,#f8fafc 0% 50%) 50%/20px 20px;border-radius:12px;min-height:260px;display:flex;align-items:center;justify-content:center;overflow:hidden}" +
    ".edp-stage img{max-width:100%;max-height:420px;display:block}" +
    ".edp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-top:10px}" +
    ".edp-th{border:1px solid #e2e8f0;border-radius:10px;padding:5px;text-align:center;font-size:11px;color:#475569;background:#fff}" +
    ".edp-th img,.edp-lock{width:100%;height:110px;object-fit:cover;border-radius:7px;display:block;margin-bottom:4px}" +
    ".edp-lock{background:#e2e8f0;display:flex!important;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#64748b;flex-direction:column}" +
    ".edp-bar{height:10px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin:8px 0}.edp-bar div{height:100%;background:linear-gradient(90deg,#7c3aed,#db2777);width:0}";
  var st = document.createElement("style");
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  function modal(inner) {
    var back = document.createElement("div");
    back.className = "edp-back";
    var box = document.createElement("div");
    box.className = "edp-box";
    box.innerHTML = inner;
    back.appendChild(box);
    document.body.appendChild(back);
    return {
      box: box,
      close: function () { if (back.parentNode) back.parentNode.removeChild(back); },
      q: function (sel) { return box.querySelector(sel); },
    };
  }

  // -------------------------------------------------------------- payments
  function loadPaystack() {
    return new Promise(function (resolve, reject) {
      if (window.PaystackPop) return resolve();
      var s = document.createElement("script");
      s.src = "https://js.paystack.co/v2/inline.js";
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("Could not load the payment window. Check your internet connection.")); };
      document.head.appendChild(s);
    });
  }
  function pay(email, quantity, aiQuantity) {
    return call("checkout", { email: email, quantity: quantity, aiQuantity: aiQuantity }).then(function (c) {
      if (c.error) throw new Error(c.error);
      if (c.free) { addToken(c.token); return c.token; }
      return loadPaystack().then(function () {
        return new Promise(function (resolve, reject) {
          var popup = new window.PaystackPop();
          popup.resumeTransaction(c.accessCode, {
            onSuccess: function (tx) {
              var ref = (tx && (tx.reference || tx.trxref)) || c.reference;
              call("verify", { reference: ref }).then(function (v) {
                if (v && v.ok && v.token) { addToken(v.token); resolve(v.token); }
                else reject(new Error((v && (v.message || v.error)) || "The payment could not be confirmed. If you were charged, WhatsApp 0203555130 with the email you used."));
              }, reject);
            },
            onCancel: function () { resolve(null); },
            onError: function (e) { reject(new Error((e && e.message) || "The payment window had a problem.")); },
          });
        });
      });
    });
  }
  function balances() {
    return Promise.all(tokens().map(function (t) {
      return call("balance", { token: t }).then(function (b) { return b && b.ok ? { token: t, downloads: b.downloads, ai: b.ai } : null; }, function () { return null; });
    })).then(function (r) { return r.filter(Boolean); });
  }
  function redeem(kind, n) {
    var list = tokens(), i = 0;
    function next() {
      if (i >= list.length) return Promise.resolve(null);
      var t = list[i++];
      return call("redeem", { token: t, kind: kind, n: n }).then(function (r) { return r && r.ok ? t : next(); }, next);
    }
    return next();
  }

  /** opts: {kind:'download'|'ai', need, price, owned, fixed, note} -> Promise<boolean paid> */
  function payDialog(opts) {
    return new Promise(function (resolve) {
      var label = opts.kind === "ai" ? "AI edit" : "download";
      var m = modal(
        "<h2>" + (opts.kind === "ai" ? "Pay to edit your photos" : "Download your edited photos") + "</h2>" +
        "<p>" + (opts.kind === "ai" ? "You are editing <b>" + opts.need + "</b> photo(s)." : "You are downloading <b>" + opts.need + "</b> edited photo(s).") +
        " Price: <b>" + money(opts.price) + "</b> per photo." + (opts.note ? " " + opts.note : "") + "</p>" +
        (opts.owned ? "<p class='edp-note'>You still have " + opts.owned + " unused paid " + label + "(s) on this device, but not enough for this batch.</p>" : "") +
        (opts.fixed ? "" : "<div class='edp-row'><label for='edp-qty'>Photos to pay for:</label><input id='edp-qty' type='number' min='" + opts.need + "' max='1000' value='" + opts.need + "'></div>") +
        "<div class='edp-total' id='edp-total'></div>" +
        "<label for='edp-email' style='font-size:14px'>Your email (Paystack sends your receipt here)</label>" +
        "<input id='edp-email' type='email' placeholder='you@example.com' autocomplete='email'>" +
        "<div id='edp-err'></div>" +
        "<div class='edp-row'><button class='edp-btn' id='edp-pay'>Pay with Paystack</button><button class='edp-btn edp-alt' id='edp-cancel'>Cancel</button></div>" +
        "<p class='edp-note'>Pay by Mobile Money or card. Secure payment by Paystack. Unused paid photos stay on this device for later.</p>"
      );
      var qty = m.q("#edp-qty"), total = m.q("#edp-total"), email = m.q("#edp-email");
      email.value = localStorage.getItem(EMAIL_KEY) || "";
      function recalc() {
        var q = qty ? Math.max(opts.need, Math.floor(Number(qty.value) || opts.need)) : opts.need;
        total.textContent = "Total: " + money(q * opts.price);
        return q;
      }
      if (qty) qty.addEventListener("input", recalc);
      recalc();
      m.q("#edp-cancel").onclick = function () { m.close(); resolve(false); };
      m.q("#edp-pay").onclick = function () {
        var btn = m.q("#edp-pay"), q = recalc(), addr = email.value.trim();
        m.q("#edp-err").innerHTML = "";
        btn.disabled = true; btn.textContent = "Opening payment...";
        localStorage.setItem(EMAIL_KEY, addr);
        pay(addr, opts.kind === "ai" ? 0 : q, opts.kind === "ai" ? q : 0).then(function (tok) {
          if (!tok) { btn.disabled = false; btn.textContent = "Pay with Paystack"; return; }
          m.close(); resolve(true);
        }, function (err) {
          btn.disabled = false; btn.textContent = "Pay with Paystack";
          m.q("#edp-err").innerHTML = "<div class='edp-err'>" + esc(err.message || err) + "</div>";
        });
      };
    });
  }

  /** Asks what to call the saved .zip folder. Resolves with the name, or null if cancelled. */
  function askName(def, title) {
    return new Promise(function (resolve) {
      var m = modal(
        "<h2>" + (title || "Name your zip folder") + "</h2>" +
        "<p>Type a name for the folder the photos will be saved in, for example your school or class name.</p>" +
        "<input id='edp-nm' type='text' maxlength='60' placeholder='e.g. Class 4 - 2026'>" +
        "<div class='edp-row'><button class='edp-btn' id='edp-ok'>Continue</button><button class='edp-btn edp-alt' id='edp-no'>Cancel</button></div>"
      );
      var inp = m.q("#edp-nm");
      inp.value = def || "";
      setTimeout(function () { inp.focus(); inp.select(); }, 50);
      function done() { var v = inp.value.trim(); if (!v) { inp.style.borderColor = "#dc2626"; return; } m.close(); resolve(v); }
      m.q("#edp-ok").onclick = done;
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") done(); });
      m.q("#edp-no").onclick = function () { m.close(); resolve(null); };
    });
  }

  // ----------------------------------------------- editor download gate
  // zipDefault === undefined -> single photo; otherwise a zip: ask for its name first.
  window.__edGate = function (n, zipDefault) {
    var chain = Promise.resolve({ name: undefined });
    if (zipDefault !== undefined) {
      chain = askName(zipDefault || "", "Name your zip folder").then(function (nm) { return nm ? { name: nm } : null; });
    }
    return chain.then(function (named) {
      if (!named) return false;
      return call("prices").then(function (p) {
        if (p.error) throw new Error(p.error);
        if (p.free) return call("redeem", { kind: "download", n: n }).then(function (r) { return r.ok ? named : false; });
        if (p.enabled === false) { alert("Downloads are paused for now. Please try again later."); return false; }
        return redeem("download", n).then(function (t) {
          if (t) return named;
          return balances().then(function (bs) {
            var owned = bs.reduce(function (a, b) { return a + b.downloads; }, 0);
            return payDialog({ kind: "download", need: n, price: p.price, owned: owned }).then(function (paid) {
              return paid ? redeem("download", n).then(function (t2) { return t2 ? named : false; }) : false;
            });
          });
        });
      });
    }).catch(function (e) {
      alert((e && e.message) || "Could not reach the payment service. Check your internet connection and try again.");
      return false;
    });
  };

  // ------------------------------------------------------------ image tools
  function downscale(file, max) {
    return createImageBitmap(file).then(function (bmp) {
      var r = Math.min(1, max / Math.max(bmp.width, bmp.height));
      var c = document.createElement("canvas");
      c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
      var x = c.getContext("2d");
      x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(res, "image/jpeg", 0.92); });
    });
  }
  function toBase64(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result).split(",")[1]); };
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  }
  function b64ToBlob(b64, mime) {
    var bin = atob(b64), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  function saveBlob(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2500);
  }

  // Minimal ZIP writer (no compression) so no library is needed.
  var CRC_T = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xffffffff; for (var i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function makeZip(files) { // files: [{name, data: Uint8Array}]
    var enc = new TextEncoder(), parts = [], central = [], offset = 0;
    var d = new Date();
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(function (f) {
      var nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
      h.setUint32(18, sz, true); h.setUint32(22, sz, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nm, f.data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true);
      c.setUint32(20, sz, true); c.setUint32(24, sz, true); c.setUint16(28, nm.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), nm);
      offset += 30 + nm.length + sz;
    });
    var cdSize = 0; central.forEach(function (p) { cdSize += p.length; });
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: "application/zip" });
  }

  // ------------------------------------------------------------ backgrounds
  var SOLIDS = [
    ["White", "#ffffff"], ["Light blue", "#cfe6fb"], ["Sky blue", "#8ec9f0"], ["Royal blue", "#1f4e9c"],
    ["Light grey", "#e5e7eb"], ["Cream", "#fdf1dc"], ["Red", "#c62828"], ["School green", "#1b7f4b"],
  ];
  var GRADS = [
    { id: "g-bluefade", name: "Blue fade", kind: "linear", stops: ["#4f9dff", "#e6f2ff"] },
    { id: "g-spot", name: "Studio spotlight", kind: "radial", stops: ["#ffffff", "#aeb6c2"] },
    { id: "g-royal", name: "Royal glow", kind: "linear", stops: ["#1e3a8a", "#60a5fa"] },
    { id: "g-green", name: "Green fade", kind: "linear", stops: ["#14532d", "#86efac"] },
    { id: "g-sunset", name: "Sunset", kind: "linear", stops: ["#fb923c", "#fde68a"] },
    { id: "g-grey", name: "Soft grey fade", kind: "linear", stops: ["#f3f4f6", "#9ca3af"] },
  ];
  function cssFor(bg) {
    if (!bg || bg.type === "none") return "repeating-conic-gradient(#d1d5db 0% 25%,#fff 0% 50%) 50%/12px 12px";
    if (bg.type === "color") return bg.value;
    return bg.kind === "radial" ? "radial-gradient(circle," + bg.stops.join(",") + ")" : "linear-gradient(" + bg.stops.join(",") + ")";
  }
  /** Draws a cut-out photo onto the chosen background at the chosen size.
   *  spec: {mode:'id'|'whole', w, h}  (w/h null = keep the photo's own size)
   *  maxW: optional, makes a small copy for on-screen thumbnails.
   *  Returns a Blob (PNG if the background is "none", otherwise JPEG). */
  function render(blob, bg, spec, maxW) {
    return createImageBitmap(blob).then(function (bmp) {
      var W = spec && spec.w ? spec.w : bmp.width, H = spec && spec.h ? spec.h : bmp.height;
      if (maxW && W > maxW) { H = Math.round(H * maxW / W); W = maxW; }
      var c = document.createElement("canvas");
      c.width = W; c.height = H;
      var x = c.getContext("2d");
      x.imageSmoothingQuality = "high";
      if (bg && bg.type !== "none") {
        if (bg.type === "color") x.fillStyle = bg.value;
        else {
          var g = bg.kind === "radial"
            ? x.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.5, Math.max(W, H) * 0.75)
            : x.createLinearGradient(0, 0, 0, H);
          g.addColorStop(0, bg.stops[0]); g.addColorStop(1, bg.stops[1]);
          x.fillStyle = g;
        }
        x.fillRect(0, 0, W, H);
      }
      var sc = (spec && spec.mode === "id") ? Math.max(W / bmp.width, H / bmp.height) : Math.min(W / bmp.width, H / bmp.height);
      var dw = bmp.width * sc, dh = bmp.height * sc;
      x.drawImage(bmp, (W - dw) / 2, (H - dh) / 2, dw, dh);
      return new Promise(function (res) {
        if (!bg || bg.type === "none") c.toBlob(res, "image/png");
        else c.toBlob(res, "image/jpeg", 0.93);
      });
    });
  }

  function editorInput() {
    var all = Array.prototype.slice.call(document.querySelectorAll("input[type=file]"));
    return all.filter(function (i) { return !i.webkitdirectory && (!i.accept || /image/.test(i.accept)); })[0] || null;
  }

  // ------------------------------------------------- face finding + framing
  var MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
  var MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
  var detectorP = null;
  function getDetector() {
    if (!detectorP) {
      detectorP = import(MP + "/vision_bundle.mjs").then(function (m) {
        return m.FilesetResolver.forVisionTasks(MP + "/wasm").then(function (fs) {
          return m.FaceDetector.createFromOptions(fs, {
            baseOptions: { modelAssetPath: MODEL },
            runningMode: "IMAGE",
            minDetectionConfidence: 0.4,
          });
        });
      }).catch(function () { return null; });
    }
    return detectorP;
  }
  /** Largest face in the picture, as {x,y,w,h} in the picture's own pixels, or null. */
  function findFace(bmp) {
    var sc = Math.min(1, 720 / Math.max(bmp.width, bmp.height));
    var c = document.createElement("canvas");
    c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return getDetector().then(function (d) {
      if (d) {
        try {
          var dets = d.detect(c).detections || [];
          var best = null;
          dets.forEach(function (t) { var b = t.boundingBox; if (!best || b.width * b.height > best.width * best.height) best = b; });
          if (best) return { x: best.originX / sc, y: best.originY / sc, w: best.width / sc, h: best.height / sc };
        } catch (e) { /* fall through */ }
      }
      if (window.FaceDetector) {
        try {
          return new window.FaceDetector({ fastMode: true }).detect(c).then(function (fs) {
            if (!fs.length) return null;
            var b = fs.sort(function (p, q) { return q.boundingBox.width - p.boundingBox.width; })[0].boundingBox;
            return { x: b.x / sc, y: b.y / sc, w: b.width / sc, h: b.height / sc };
          }, function () { return null; });
        } catch (e) { return null; }
      }
      return null;
    });
  }
  /** The crop (in picture pixels) that frames an ID photo: face centred, head and shoulders. */
  var FRAME = { head: 12, size: 42 }; // % space above hair, % of photo height taken by the face
  function idCrop(face, W, H, ar) {
    var ch, cw, left, top;
    if (face) {
      ch = face.h / (FRAME.size / 100); cw = ch * ar;
      var hairTop = face.y - 0.5 * face.h; // the detector box starts at the forehead, hair is above it
      top = hairTop - (FRAME.head / 100) * ch;
      left = face.x + face.w / 2 - cw / 2;
      // never shift the crop to fit the picture: any gap is filled with white so the head is never cut
    } else {
      cw = Math.min(W, H * ar); ch = cw / ar;
      left = (W - cw) / 2; top = Math.max(0, (H - ch) * 0.1);
    }
    return { x: left, y: top, w: cw, h: ch };
  }
  /** Frames the picture (face centred for ID photos) and shrinks it for the AI. Returns {blob, faceFound}. */
  function prepare(file, spec) {
    return createImageBitmap(file, { imageOrientation: "from-image" }).then(function (bmp) {
      if (spec.mode !== "id") {
        return { blob: null, bmp: bmp, faceFound: true };
      }
      return findFace(bmp).then(function (face) { return { bmp: bmp, face: face, faceFound: !!face }; });
    }).then(function (p) {
      var bmp = p.bmp, c = document.createElement("canvas"), x = c.getContext("2d");
      var max = 1024;
      if (spec.mode === "id") {
        var ar = spec.w / spec.h, cr = idCrop(p.face, bmp.width, bmp.height, ar);
        var sc = Math.min(1, max / Math.max(cr.w, cr.h));
        c.width = Math.max(1, Math.round(cr.w * sc)); c.height = Math.max(1, Math.round(cr.h * sc));
        x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height);
        var kx = c.width / cr.w, ky = c.height / cr.h;
        var sx = Math.max(0, cr.x), sy = Math.max(0, cr.y), ex = Math.min(bmp.width, cr.x + cr.w), ey = Math.min(bmp.height, cr.y + cr.h);
        if (ex > sx && ey > sy) x.drawImage(bmp, sx, sy, ex - sx, ey - sy, (sx - cr.x) * kx, (sy - cr.y) * ky, (ex - sx) * kx, (ey - sy) * ky);
      } else {
        var s2 = Math.min(1, max / Math.max(bmp.width, bmp.height));
        c.width = Math.round(bmp.width * s2); c.height = Math.round(bmp.height * s2);
        x.drawImage(bmp, 0, 0, c.width, c.height);
      }
      return new Promise(function (res) { c.toBlob(function (b) { res({ blob: b, faceFound: p.faceFound }); }, "image/jpeg", 0.9); });
    });
  }

  var SIZES = [
    { id: "passport", name: "Passport 35 x 45 mm", w: 413, h: 531 },
    { id: "us", name: "Square 2 x 2 inch", w: 600, h: 600 },
    { id: "p34", name: "Portrait 3:4 (600 x 800 px)", w: 600, h: 800 },
    { id: "id25", name: "Small ID 25 x 30 mm", w: 295, h: 354 },
    { id: "sq", name: "Square 500 x 500 px", w: 500, h: 500 },
    { id: "custom", name: "Custom size..." },
  ];

  // ------------------------------------------------------------ the studio
  function openStudio(cfg) {
    cfg = cfg || {};
    var page = !!cfg.page, embed = !!cfg.embed;
    var files = [], results = [], flags = [], sample = null, processed = false;
    var mode = "remove", color = "#ffffff", presetId = "", enhance = false;
    var ptype = "id", sizeId = "passport", cw = "35", ch = "45", cunit = "mm";
    var prices = null;

    var root = document.createElement("div");
    root.className = "edp-studio" + (page ? " edp-page" : "");
    root.innerHTML =
      "<div class='edp-head'><h1>✨ AI Photo Studio</h1><div>" +
      (page ? "<a href='/tools/photo-editor.html'>Open Photo Editor</a>" : "<button id='edp-close'>Close</button>") + "</div></div>" +
      "<div class='edp-wrap'>" +
      "<div class='edp-card'><h3>1. Add the photos</h3>" +
      "<div class='edp-drop' id='edp-drop'>Tap here to choose photos<br><span style='font-weight:500;font-size:13px;color:#7c3aed'>" + (embed ? "one photo" : "up to 50 photos at a time") + "</span></div>" +
      "<input id='edp-files' type='file' accept='image/*' " + (embed ? "" : "multiple") + " style='display:none'>" +
      "<div class='edp-grid' id='edp-grid'></div></div>" +
      "<div class='edp-card'><h3>2. Photo type and size</h3><div class='edp-opts'>" +
      "<div class='edp-opt edp-on' data-type='id'><b>ID photo</b><span>The AI finds the face, centres it, and crops head and shoulders to your size.</span></div>" +
      "<div class='edp-opt' data-type='whole'><b>Whole photo</b><span>Keeps the whole picture. Only the background is changed.</span></div></div>" +
      "<div class='edp-row'><label for='edp-size'>Size:</label><select id='edp-size' style='padding:9px;border-radius:8px;border:1px solid #cbd5e1;font-size:15px'></select></div>" +
      "<div id='edp-frame'><div class='edp-row'><label style='min-width:170px'>Space above head: <b id='edp-hv'>12</b>%</label><input type='range' id='edp-head' min='0' max='30' value='12' style='flex:1;min-width:140px'></div>" +
      "<div class='edp-row'><label style='min-width:170px'>Face size: <b id='edp-sv'>42</b>%</label><input type='range' id='edp-fsize' min='25' max='65' value='42' style='flex:1;min-width:140px'><span class='edp-note'>smaller = more shoulders</span></div></div>" +
      "<div class='edp-row' id='edp-custom' style='display:none'>" +
      "<input type='number' id='edp-cw' min='1' value='35' style='width:90px'> × <input type='number' id='edp-ch' min='1' value='45' style='width:90px'>" +
      "<select id='edp-cu' style='padding:9px;border-radius:8px;border:1px solid #cbd5e1'><option value='mm'>mm</option><option value='cm'>cm</option><option value='px'>pixels</option></select>" +
      "<span class='edp-note'>width × height (printed at 300 dots per inch)</span></div></div>" +
      "<div class='edp-card'><h3>3. What should the AI do with the background?</h3><div class='edp-opts'>" +
      "<div class='edp-opt edp-on' data-mode='remove'><b>Remove background only</b><span>Cuts the person out. Saved as a transparent PNG.</span></div>" +
      "<div class='edp-opt' data-mode='color'><b>Change background colour</b><span>Pick any colour you like.</span>" +
      "<div class='edp-row' style='margin:8px 0 0'><input type='color' id='edp-color' value='#ffffff' style='width:60px;height:38px;border:0;padding:0;background:none'><div class='edp-sw' id='edp-solids'></div></div></div>" +
      "<div class='edp-opt' data-mode='preset'><b>Ready-made backgrounds</b><span>Choose a studio colour or gradient.</span><div class='edp-sw' id='edp-presets'></div></div>" +
      "</div><div class='edp-row'><label><input type='checkbox' id='edp-enh'> Also fix lighting and colour (AI)</label></div>" +
      "<div class='edp-note'>Colours and backgrounds can be changed again after payment at no extra cost.</div></div>" +
      "<div class='edp-card'><h3>4. Free sample, then pay</h3><div class='edp-two'>" +
      "<div><div class='edp-stage' id='edp-stage'><span class='edp-note'>Your free sample appears here</span></div>" +
      "<div class='edp-note' style='margin-top:6px'>Only the first photo is shown, small and marked EduLinkGH. The rest appear after payment.</div></div>" +
      "<div><div id='edp-price' class='edp-note'>Add photos to see the price.</div>" +
      "<div class='edp-row' id='edp-email-row'><input type='email' id='edp-mail' placeholder='Your email (for the Paystack receipt)' autocomplete='email'></div>" +
      "<div class='edp-row'><button class='edp-btn edp-ai edp-big' id='edp-prev' disabled>See free sample of photo 1</button></div>" +
      "<div class='edp-row'><button class='edp-btn edp-big' id='edp-go' disabled>Pay &amp; edit all photos</button></div>" +
      "<div id='edp-msg'></div><div class='edp-bar' id='edp-bar' style='display:none'><div></div></div></div></div></div>" +
      "<div class='edp-card' id='edp-done' style='display:none'><h3>5. Your finished photos</h3>" +
      "<div class='edp-row'><button class='edp-btn edp-big' id='edp-zip'>Download all (ZIP)</button>" +
      "<button class='edp-btn edp-alt' id='edp-toed' style='display:none'>Add to the Photo Editor</button>" +
      "<button class='edp-btn edp-big' id='edp-use' style='display:none'>Use this photo</button></div>" +
      "<div id='edp-check' class='edp-note'></div><div class='edp-grid' id='edp-res'></div></div>" +
      "<p class='edp-note'>Photos are sent to an AI service only to be edited and are not kept by EduLink GH. Only use photos you have permission to process. Always check the result.</p>" +
      "</div>";
    document.body.appendChild(root);
    if (!page) document.documentElement.style.overflow = "hidden";
    var $ = function (s) { return root.querySelector(s); };
    var grid = $("#edp-grid"), msg = $("#edp-msg"), stage = $("#edp-stage");

    function close() {
      if (page) return;
      if (root.parentNode) root.parentNode.removeChild(root);
      document.documentElement.style.overflow = "";
    }
    if ($("#edp-close")) $("#edp-close").onclick = close;
    function say(html, kind) { msg.innerHTML = html ? "<div class='" + (kind === "err" ? "edp-err" : kind === "ok" ? "edp-ok" : "edp-note") + "'>" + html + "</div>" : ""; }
    function stale() { if (sample) { sample = null; refreshStage(); say("You changed an option, so please take the free sample again.", "info"); } }

    // ---- size + type
    var sizeSel = $("#edp-size");
    function fillSizes() {
      sizeSel.innerHTML = "";
      if (ptype === "whole") sizeSel.innerHTML = "<option value='orig'>Keep the original size</option>";
      SIZES.forEach(function (z) { sizeSel.innerHTML += "<option value='" + z.id + "'>" + z.name + "</option>"; });
      if (ptype === "id" && sizeId === "orig") sizeId = "passport";
      sizeSel.value = sizeId;
    }
    fillSizes();
    function toPx(v, unit) { v = Number(v) || 0; return Math.max(50, Math.min(4000, Math.round(unit === "px" ? v : unit === "cm" ? v / 2.54 * 300 : v / 25.4 * 300))); }
    function spec() {
      if (ptype === "whole" && sizeId === "orig") return { mode: "whole", w: null, h: null };
      if (sizeId === "custom") return { mode: ptype, w: toPx(cw, cunit), h: toPx(ch, cunit) };
      var z = SIZES.filter(function (s) { return s.id === sizeId; })[0] || SIZES[0];
      return { mode: ptype, w: z.w, h: z.h };
    }
    $("#edp-head").oninput = function (e) { FRAME.head = +e.target.value; $("#edp-hv").textContent = e.target.value; stale(); };
    $("#edp-fsize").oninput = function (e) { FRAME.size = +e.target.value; $("#edp-sv").textContent = e.target.value; stale(); };
    sizeSel.onchange = function () { sizeId = sizeSel.value; $("#edp-custom").style.display = sizeId === "custom" ? "" : "none"; stale(); };
    ["#edp-cw", "#edp-ch"].forEach(function (id) { $(id).oninput = function () { cw = $("#edp-cw").value; ch = $("#edp-ch").value; stale(); }; });
    $("#edp-cu").onchange = function () { cunit = $("#edp-cu").value; stale(); };
    Array.prototype.forEach.call(root.querySelectorAll("[data-type]"), function (o) {
      o.onclick = function () {
        ptype = o.dataset.type;
        Array.prototype.forEach.call(root.querySelectorAll("[data-type]"), function (x) { x.classList.toggle("edp-on", x.dataset.type === ptype); });
        sizeId = ptype === "whole" ? "orig" : "passport";
        fillSizes(); $("#edp-custom").style.display = "none"; $("#edp-frame").style.display = ptype === "id" ? "" : "none"; stale(); refreshResultsLater();
      };
    });

    function curBg() {
      if (mode === "remove") return { type: "none" };
      if (mode === "color") return { type: "color", value: color };
      var s1 = SOLIDS.filter(function (x) { return "s-" + x[1] === presetId; })[0];
      if (s1) return { type: "color", value: s1[1] };
      var g = GRADS.filter(function (x) { return x.id === presetId; })[0];
      return g ? { type: "grad", kind: g.kind, stops: g.stops } : { type: "none" };
    }

    // swatches
    var solidsEl = $("#edp-solids"), presetsEl = $("#edp-presets");
    SOLIDS.slice(0, 5).forEach(function (s) {
      var i = document.createElement("i"); i.title = s[0]; i.style.background = s[1];
      i.onclick = function (e) { e.stopPropagation(); color = s[1]; $("#edp-color").value = s[1]; setMode("color"); };
      solidsEl.appendChild(i);
    });
    SOLIDS.forEach(function (s) { addPreset("s-" + s[1], s[0], s[1]); });
    GRADS.forEach(function (g) { addPreset(g.id, g.name, cssFor({ type: "grad", kind: g.kind, stops: g.stops })); });
    function addPreset(id, name, bgcss) {
      var i = document.createElement("i"); i.title = name; i.dataset.id = id; i.style.background = bgcss;
      i.onclick = function (e) { e.stopPropagation(); presetId = id; setMode("preset"); };
      presetsEl.appendChild(i);
    }
    $("#edp-color").oninput = function (e) { color = e.target.value; setMode("color"); };
    $("#edp-color").onclick = function (e) { e.stopPropagation(); };
    $("#edp-enh").onchange = function (e) { enhance = e.target.checked; stale(); };
    Array.prototype.forEach.call(root.querySelectorAll("[data-mode]"), function (o) {
      o.onclick = function () { setMode(o.dataset.mode); };
    });
    function setMode(m) {
      mode = m;
      if (m === "preset" && !presetId) presetId = "s-" + SOLIDS[0][1];
      Array.prototype.forEach.call(root.querySelectorAll("[data-mode]"), function (o) { o.classList.toggle("edp-on", o.dataset.mode === m); });
      Array.prototype.forEach.call(presetsEl.children, function (i) { i.classList.toggle("edp-on", m === "preset" && i.dataset.id === presetId); });
      refreshStage(); refreshResults();
    }

    // file picking
    $("#edp-drop").onclick = function () { $("#edp-files").click(); };
    $("#edp-files").onchange = function (e) {
      files = Array.prototype.slice.call(e.target.files || []).slice(0, embed ? 1 : 50);
      results = []; flags = []; sample = null; processed = false;
      $("#edp-done").style.display = "none";
      drawGrid(); refreshStage(); updatePrice();
    };
    function drawGrid() {
      grid.innerHTML = "";
      files.forEach(function (f, i) {
        var d = document.createElement("div"); d.className = "edp-th";
        if (i === 0) {
          var im = document.createElement("img"); im.src = URL.createObjectURL(f); d.appendChild(im);
          d.appendChild(document.createTextNode("Photo 1 · " + f.name.slice(0, 14)));
        } else {
          var l = document.createElement("div"); l.className = "edp-lock"; l.innerHTML = "<span>🔒</span><span>Photo " + (i + 1) + "</span>"; d.appendChild(l);
          d.appendChild(document.createTextNode("Hidden until paid"));
        }
        grid.appendChild(d);
      });
    }
    function sampleSpec() {
      var sp = spec();
      if (sp.w) return { mode: sp.mode, w: 360, h: Math.round(360 * sp.h / sp.w) };
      return { mode: "whole", w: null, h: null };
    }
    function refreshStage() {
      if (!sample) { stage.innerHTML = "<span class='edp-note'>Your free sample appears here</span>"; return; }
      render(sample, curBg(), sampleSpec()).then(function (b) {
        stage.innerHTML = ""; var im = document.createElement("img"); im.src = URL.createObjectURL(b); stage.appendChild(im);
      });
    }
    function unitPrice(n) { return n >= prices.aiBulkMin ? prices.aiBulkPrice : prices.aiPrice; }
    function updatePrice() {
      var n = files.length;
      $("#edp-prev").disabled = n === 0;
      $("#edp-go").disabled = n === 0;
      $("#edp-go").innerHTML = n ? "Pay &amp; edit " + (n === 1 ? "this photo" : "all " + n + " photos") : "Pay &amp; edit all photos";
      var pe = $("#edp-price");
      if (!prices) { pe.textContent = "Loading prices..."; return; }
      if (prices.free) { pe.innerHTML = "<div class='edp-ok'>Super Admin: free</div>"; $("#edp-email-row").style.display = "none"; return; }
      if (!n) { pe.innerHTML = "Single photo: <b>" + money(prices.aiPrice) + "</b> each. Bulk (" + prices.aiBulkMin + " or more): <b>" + money(prices.aiBulkPrice) + "</b> each."; return; }
      var u = unitPrice(n);
      pe.innerHTML = "<div class='edp-total'>" + n + " × " + money(u) + " = " + money(n * u) + "</div>" +
        "<div class='edp-note'>" + (n >= prices.aiBulkMin ? "Bulk price applied." : "Single price. Edit " + prices.aiBulkMin + " or more together for " + money(prices.aiBulkPrice) + " each.") + "</div>";
    }
    call("prices").then(function (p) {
      if (p.error) { say(esc(p.error), "err"); return; }
      prices = p; updatePrice();
      if (p.enabled === false && !p.free) { say("The AI studio is paused for now. Please try again later.", "err"); $("#edp-go").disabled = true; $("#edp-prev").disabled = true; }
    }, function () { say("Could not reach the service. Check your internet connection.", "err"); });
    getDetector(); // start loading the face finder in the background

    /** Frame the photo, send it to the AI, retry politely if the AI is busy. */
    function aiOne(file, useTokens) {
      var sp = spec();
      return prepare(file, sp).then(function (p) {
        return toBase64(p.blob).then(function (b64) {
          var list = useTokens ? (tokens().length ? tokens() : [""]) : [null], k = 0, tries = 0;
          function go() {
            var payload = { image: b64, mime: "image/jpeg", enhance: enhance };
            if (useTokens) payload.token = list[k];
            return call(useTokens ? "ai_process" : "ai_preview", payload).then(function (r) {
              if (r && r.ok) return { blob: b64ToBlob(r.image, r.mime || "image/png"), faceFound: p.faceFound };
              if (r && r._status === 402 && useTokens && ++k < list.length) return go();
              var m = String((r && r.error) || "");
              if (/rate limit|try again|busy|overloaded/i.test(m) && ++tries <= 3) {
                return new Promise(function (res) { setTimeout(res, 4000 * tries); }).then(go);
              }
              throw new Error(m || "The AI edit failed.");
            });
          }
          return go();
        });
      });
    }

    // free sample
    $("#edp-prev").onclick = function () {
      if (!files.length) return;
      var b = $("#edp-prev"); b.disabled = true; b.textContent = "Making sample... (up to 40 seconds)";
      say("");
      aiOne(files[0], false).then(function (r) {
        sample = r.blob;
        refreshStage();
        say(r.faceFound || spec().mode !== "id"
          ? "This is a small sample marked EduLinkGH. Pay to get all your photos clean and full size."
          : "A face was not found in this photo, so it was centred roughly. Check it carefully.", "info");
      }).catch(function (e) { say(esc(e.message || e), "err"); }).then(function () { b.disabled = false; b.textContent = "See free sample of photo 1"; });
    };

    // pay + process
    $("#edp-go").onclick = function () {
      var n = files.length; if (!n || !prices) return;
      var go = $("#edp-go"); go.disabled = true; say("");
      var need = prices.free ? Promise.resolve(true) : balances().then(function (bs) {
        var have = bs.reduce(function (a, x) { return a + x.ai; }, 0);
        if (have >= n) return true;
        return payDialog({ kind: "ai", need: n, price: unitPrice(n), owned: have, fixed: true,
          note: n >= prices.aiBulkMin ? "(bulk price)" : "" });
      });
      need.then(function (ok) {
        if (!ok) { go.disabled = false; return; }
        var done = 0, failed = 0, next = 0, startedAt = Date.now();
        results = new Array(n); flags = new Array(n);
        var bar = $("#edp-bar"); bar.style.display = ""; bar.firstChild.style.width = "0";
        function worker() {
          if (next >= n) return Promise.resolve();
          var i = next++;
          return aiOne(files[i], true).then(function (r) { results[i] = r.blob; flags[i] = r.faceFound; },
            function (e) { failed++; say("Photo " + (i + 1) + " could not be edited: " + esc(e.message || e) + " (you are not charged for it).", "err"); })
            .then(function () {
              done++; bar.firstChild.style.width = Math.round(done / n * 100) + "%";
              var el = (Date.now() - startedAt) / 1000, left = Math.round(el / done * (n - done));
              say("Editing... " + done + " of " + n + " done" + (done < n ? " (about " + Math.max(1, Math.round(left / 60)) + " min left)" : ""));
              return worker();
            });
        }
        var N = Math.min(4, n), ws = [];
        for (var q = 0; q < N; q++) ws.push(worker());
        return Promise.all(ws).then(function () {
          bar.style.display = "none"; go.disabled = false;
          processed = results.some(Boolean);
          say(processed ? (n - failed) + " photo(s) edited." + (failed ? " " + failed + " failed (not charged)." : "") : "", processed ? "ok" : "");
          refreshResults();
        });
      }).catch(function (e) { go.disabled = false; say(esc(e.message || e), "err"); });
    };

    // results
    var rrTimer = null;
    function refreshResultsLater() { clearTimeout(rrTimer); rrTimer = setTimeout(refreshResults, 50); }
    function refreshResults() {
      if (!processed) return;
      $("#edp-done").style.display = "";
      var resEl = $("#edp-res"); resEl.innerHTML = "";
      $("#edp-toed").style.display = (!page && editorInput()) ? "" : "none";
      $("#edp-use").style.display = embed ? "" : "none";
      $("#edp-zip").style.display = embed ? "none" : "";
      var bg = curBg(), sp = spec(), nofaces = 0;
      results.forEach(function (b, i) {
        if (!b) return;
        if (sp.mode === "id" && flags[i] === false) nofaces++;
        var d = document.createElement("div"); d.className = "edp-th";
        var im = document.createElement("img"); d.appendChild(im);
        d.appendChild(document.createTextNode(files[i].name.slice(0, 16) + (sp.mode === "id" && flags[i] === false ? " ⚠" : "")));
        var a = document.createElement("div"); a.style.marginTop = "4px";
        var bt = document.createElement("button"); bt.className = "edp-btn edp-alt"; bt.style.padding = "5px 10px"; bt.style.fontSize = "12px"; bt.textContent = "Download";
        bt.onclick = function () { render(b, curBg(), spec()).then(function (o) { saveBlob(o, baseName(files[i].name) + (curBg().type === "none" ? ".png" : ".jpg")); }); };
        a.appendChild(bt); d.appendChild(a); resEl.appendChild(d);
        render(b, bg, sp, 260).then(function (o) { im.src = URL.createObjectURL(o); im.style.background = cssFor(bg); im.style.objectFit = "contain"; });
      });
      $("#edp-check").innerHTML = nofaces ? "⚠ " + nofaces + " photo(s) had no clear face, so they were centred roughly. Please check them." : "";
    }
    function allRendered() {
      var bg = curBg(), sp = spec(), ext = bg.type === "none" ? ".png" : ".jpg", used = {};
      return Promise.all(results.map(function (b, i) {
        if (!b) return null;
        return render(b, bg, sp).then(function (o) {
          var nm = baseName(files[i].name), k = nm, c = 1;
          while (used[k + ext]) k = nm + "-" + (++c);
          used[k + ext] = 1;
          return o.arrayBuffer().then(function (ab) { return { name: k + ext, data: new Uint8Array(ab), blob: o }; });
        });
      })).then(function (r) { return r.filter(Boolean); });
    }
    $("#edp-zip").onclick = function () {
      askName(cfg.zipName || "edited-photos", "Name your zip folder").then(function (nm) {
        if (!nm) return;
        allRendered().then(function (list) { saveBlob(makeZip(list), safeName(nm, "edited-photos") + ".zip"); });
      });
    };
    $("#edp-toed").onclick = function () {
      var inp = editorInput();
      if (!inp) { say("Could not find the editor's upload box here.", "err"); return; }
      allRendered().then(function (list) {
        var dt = new DataTransfer();
        list.forEach(function (f) { dt.items.add(new File([f.blob], f.name, { type: f.blob.type })); });
        inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true }));
        close();
      });
    };
    $("#edp-use").onclick = function () {
      allRendered().then(function (list) {
        if (!list.length) return;
        var fr = new FileReader();
        fr.onload = function () {
          try { window.opener && window.opener.postMessage({ type: "edulink-ai-photo", dataUrl: String(fr.result) }, location.origin); } catch (e) {}
          window.close();
          say("Photo sent. You can close this window.", "ok");
        };
        fr.readAsDataURL(list[0].blob);
      });
    };
    updatePrice();
  }
  window.EduLinkStudio = { open: openStudio };

  // ------------------------------------------------ conspicuous editor ribbon
  function mountRibbon() {
    if (document.getElementById("edp-ribbon") || window.EDULINK_STUDIO_PAGE) return;
    var r = document.createElement("div");
    r.id = "edp-ribbon"; r.className = "edp-ribbon";
    r.innerHTML = "<span>✨ AI Photo Studio: remove or change photo backgrounds in seconds</span>";
    var b = document.createElement("button");
    b.textContent = "Open AI Studio";
    b.onclick = function () { openStudio({ zipName: "" }); };
    r.appendChild(b);
    document.body.appendChild(r);
    document.body.style.paddingTop = "56px";
  }
  function boot() {
    if (window.EDULINK_STUDIO_PAGE) {
      var q = new URLSearchParams(location.search);
      openStudio({ page: true, embed: q.get("embed") === "1" });
    } else {
      mountRibbon();
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

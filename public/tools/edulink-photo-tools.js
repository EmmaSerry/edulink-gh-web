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
  /** Puts the cut-out photo on the chosen background. Returns a Blob (PNG if no background, else JPEG). */
  function compose(blob, bg) {
    return createImageBitmap(blob).then(function (bmp) {
      var c = document.createElement("canvas");
      c.width = bmp.width; c.height = bmp.height;
      var x = c.getContext("2d");
      if (bg && bg.type !== "none") {
        if (bg.type === "color") x.fillStyle = bg.value;
        else {
          var g = bg.kind === "radial"
            ? x.createRadialGradient(c.width / 2, c.height * 0.4, 10, c.width / 2, c.height * 0.5, Math.max(c.width, c.height) * 0.75)
            : x.createLinearGradient(0, 0, 0, c.height);
          g.addColorStop(0, bg.stops[0]); g.addColorStop(1, bg.stops[1]);
          x.fillStyle = g;
        }
        x.fillRect(0, 0, c.width, c.height);
      }
      x.drawImage(bmp, 0, 0);
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

  // ------------------------------------------------------------ the studio
  function openStudio(cfg) {
    cfg = cfg || {};
    var page = !!cfg.page, embed = !!cfg.embed;
    var files = [], results = [], sample = null, processed = false;
    var mode = "remove", color = "#ffffff", presetId = "", enhance = false;
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
      "<div class='edp-card'><h3>2. What should the AI do?</h3><div class='edp-opts'>" +
      "<div class='edp-opt edp-on' data-mode='remove'><b>Remove background only</b><span>Cuts the person out. Saved as a transparent PNG.</span></div>" +
      "<div class='edp-opt' data-mode='color'><b>Change background colour</b><span>Pick any colour you like.</span>" +
      "<div class='edp-row' style='margin:8px 0 0'><input type='color' id='edp-color' value='#ffffff' style='width:60px;height:38px;border:0;padding:0;background:none'><div class='edp-sw' id='edp-solids'></div></div></div>" +
      "<div class='edp-opt' data-mode='preset'><b>Ready-made backgrounds</b><span>Choose a studio colour or gradient.</span><div class='edp-sw' id='edp-presets'></div></div>" +
      "</div><div class='edp-row'><label><input type='checkbox' id='edp-enh'> Also fix lighting and colour (AI)</label></div>" +
      "<div class='edp-note'>Colours and backgrounds can be changed again after payment at no extra cost.</div></div>" +
      "<div class='edp-card'><h3>3. Free sample, then pay</h3><div class='edp-two'>" +
      "<div><div class='edp-stage' id='edp-stage'><span class='edp-note'>Your free sample appears here</span></div>" +
      "<div class='edp-note' style='margin-top:6px'>Only the first photo is shown, small and marked EduLinkGH. The rest appear after payment.</div></div>" +
      "<div><div id='edp-price' class='edp-note'>Add photos to see the price.</div>" +
      "<div class='edp-row' id='edp-email-row'><input type='email' id='edp-mail' placeholder='Your email (for the Paystack receipt)' autocomplete='email'></div>" +
      "<div class='edp-row'><button class='edp-btn edp-ai edp-big' id='edp-prev' disabled>See free sample of photo 1</button></div>" +
      "<div class='edp-row'><button class='edp-btn edp-big' id='edp-go' disabled>Pay &amp; edit all photos</button></div>" +
      "<div id='edp-msg'></div><div class='edp-bar' id='edp-bar' style='display:none'><div></div></div></div></div></div>" +
      "<div class='edp-card' id='edp-done' style='display:none'><h3>4. Your finished photos</h3>" +
      "<div class='edp-row'><button class='edp-btn edp-big' id='edp-zip'>Download all (ZIP)</button>" +
      "<button class='edp-btn edp-alt' id='edp-toed' style='display:none'>Add to the Photo Editor</button>" +
      "<button class='edp-btn edp-big' id='edp-use' style='display:none'>Use this photo</button></div>" +
      "<div class='edp-grid' id='edp-res'></div></div>" +
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

    function curBg() {
      if (mode === "remove") return { type: "none" };
      if (mode === "color") return { type: "color", value: color };
      var s = SOLIDS.filter(function (x) { return "s-" + x[1] === presetId; })[0];
      if (s) return { type: "color", value: s[1] };
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
    $("#edp-enh").onchange = function (e) { enhance = e.target.checked; if (sample) { sample = null; refreshStage(); say("You changed an option, so please take the free sample again.", "info"); } };
    Array.prototype.forEach.call(root.querySelectorAll(".edp-opt"), function (o) {
      o.onclick = function () { setMode(o.dataset.mode); };
    });
    function setMode(m) {
      mode = m;
      if (m === "preset" && !presetId) presetId = "s-" + SOLIDS[0][1];
      Array.prototype.forEach.call(root.querySelectorAll(".edp-opt"), function (o) { o.classList.toggle("edp-on", o.dataset.mode === m); });
      Array.prototype.forEach.call(presetsEl.children, function (i) { i.classList.toggle("edp-on", m === "preset" && i.dataset.id === presetId); });
      refreshStage(); refreshResults();
    }

    // file picking
    $("#edp-drop").onclick = function () { $("#edp-files").click(); };
    $("#edp-files").onchange = function (e) {
      files = Array.prototype.slice.call(e.target.files || []).slice(0, embed ? 1 : 50);
      results = []; sample = null; processed = false;
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
    function refreshStage() {
      stage.style.background = "";
      if (!sample) { stage.innerHTML = "<span class='edp-note'>Your free sample appears here</span>"; return; }
      compose(sample, curBg()).then(function (b) {
        stage.innerHTML = ""; var im = document.createElement("img"); im.src = URL.createObjectURL(b); stage.appendChild(im);
      });
    }
    function unitPrice(n) { return n >= prices.aiBulkMin ? prices.aiBulkPrice : prices.aiPrice; }
    function updatePrice() {
      var n = files.length;
      $("#edp-prev").disabled = n === 0;
      $("#edp-go").disabled = n === 0;
      $("#edp-go").innerHTML = n ? "Pay &amp; edit " + (n === 1 ? "this photo" : "all " + n + " photos") : "Pay &amp; edit all photos";
      $("#edp-prev").textContent = "See free sample of photo 1";
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

    // free sample
    $("#edp-prev").onclick = function () {
      if (!files.length) return;
      var b = $("#edp-prev"); b.disabled = true; b.textContent = "Making sample... (20-40 seconds)";
      say("");
      downscale(files[0], 1280).then(toBase64).then(function (b64) {
        return call("ai_preview", { image: b64, mime: "image/jpeg", enhance: enhance });
      }).then(function (r) {
        if (!r.ok) throw new Error(r.error || "The sample could not be made.");
        sample = b64ToBlob(r.image, r.mime || "image/png");
        refreshStage();
        say("This is a small sample marked EduLinkGH. Pay to get all your photos clean and full size.", "info");
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
        var done = 0, failed = 0, next = 0;
        results = new Array(n);
        var bar = $("#edp-bar"); bar.style.display = ""; bar.firstChild.style.width = "0";
        function worker() {
          if (next >= n) return Promise.resolve();
          var i = next++;
          return downscale(files[i], 1536).then(toBase64).then(function (b64) {
            var list = tokens().length ? tokens() : [""], k = 0;
            function tryTok() {
              return call("ai_process", { token: list[k], image: b64, mime: "image/jpeg", enhance: enhance }).then(function (r) {
                if (r && r.ok) return r;
                if (r && r._status === 402 && ++k < list.length) return tryTok();
                throw new Error((r && r.error) || "The AI edit failed.");
              });
            }
            return tryTok();
          }).then(function (r) { results[i] = b64ToBlob(r.image, "image/png"); },
            function (e) { failed++; say("Photo " + (i + 1) + " could not be edited: " + esc(e.message || e) + " (you are not charged for it).", "err"); })
            .then(function () { done++; bar.firstChild.style.width = Math.round(done / n * 100) + "%"; say("Editing... " + done + " of " + n + " done"); return worker(); });
        }
        return Promise.all([worker(), worker()]).then(function () {
          bar.style.display = "none"; go.disabled = false;
          processed = results.some(Boolean);
          say(processed ? (n - failed) + " photo(s) edited." + (failed ? " " + failed + " failed (not charged)." : "") : "", processed ? "ok" : "");
          refreshResults();
        });
      }).catch(function (e) { go.disabled = false; say(esc(e.message || e), "err"); });
    };

    // results
    function refreshResults() {
      if (!processed) return;
      $("#edp-done").style.display = "";
      var resEl = $("#edp-res"); resEl.innerHTML = "";
      $("#edp-toed").style.display = (!page && editorInput()) ? "" : "none";
      $("#edp-use").style.display = embed ? "" : "none";
      $("#edp-zip").style.display = embed ? "none" : "";
      var bg = curBg();
      results.forEach(function (b, i) {
        if (!b) return;
        var d = document.createElement("div"); d.className = "edp-th";
        var im = document.createElement("img"); d.appendChild(im);
        d.appendChild(document.createTextNode(files[i].name.slice(0, 16)));
        var a = document.createElement("div"); a.style.marginTop = "4px";
        var bt = document.createElement("button"); bt.className = "edp-btn edp-alt"; bt.style.padding = "5px 10px"; bt.style.fontSize = "12px"; bt.textContent = "Download";
        bt.onclick = function () { compose(b, curBg()).then(function (o) { saveBlob(o, baseName(files[i].name) + (curBg().type === "none" ? ".png" : ".jpg")); }); };
        a.appendChild(bt); d.appendChild(a); resEl.appendChild(d);
        compose(b, bg).then(function (o) { im.src = URL.createObjectURL(o); im.style.background = cssFor(bg); });
      });
    }
    function allComposed() {
      var bg = curBg(), ext = bg.type === "none" ? ".png" : ".jpg", used = {};
      return Promise.all(results.map(function (b, i) {
        if (!b) return null;
        return compose(b, bg).then(function (o) {
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
        allComposed().then(function (list) { saveBlob(makeZip(list), safeName(nm, "edited-photos") + ".zip"); });
      });
    };
    $("#edp-toed").onclick = function () {
      var inp = editorInput();
      if (!inp) { say("Could not find the editor's upload box here.", "err"); return; }
      allComposed().then(function (list) {
        var dt = new DataTransfer();
        list.forEach(function (f) { dt.items.add(new File([f.blob], f.name, { type: f.blob.type })); });
        inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true }));
        close();
      });
    };
    $("#edp-use").onclick = function () {
      allComposed().then(function (list) {
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

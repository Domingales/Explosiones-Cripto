// ================= UIEXPLOSIONES.JS =================
// Interfaz, sonidos, semáforo y registros
console.log("✅ init() ejecutado correctamente");

(() => {
  const FETCH_INTERVAL_MS = 60000; // <- AJUSTABLE
  const INTERVALOS = ["5m", "10m", "15m", "30m", "1h", "2h"];
  const CRYPTOS = [
    "ADA", "AVAX", "BCH", "BNB", "BTC", "DOGE", "DOT", "ETC", "ETH", "ICP",
    "LINK", "LTC", "MANA", "MATIC", "NEAR", "OP", "QNT", "SHIB", "SOL", "STX",
    "SUI", "THETA", "TON", "TRX", "UNI", "VET", "XLM", "XRP", "XTZ", "ZEC"
  ];

  window.EC = {
    running: false,
    sonidoActivo: true,
    intervaloIdx: 2, // 15m por defecto
    umbralMin: 15,
    umbralMax: Infinity,
    seleccionadas: new Set(["BTC", "ETH", "ADA", "SOL"]),
    timer: null,
    lastAlertKey: {},
    countdownTimer: null,
    countdownValue: 0,
  };

  // === Atajos DOM ===
  const $ = sel => document.querySelector(sel);
  const lblIntervalo = $("#intervalo-label");
  const btnPrev = $("#int-prev");
  const btnNext = $("#int-next");
  const rngMin = $("#umbral-min");
  const lblMin = $("#umbral-min-val");
  const chkInf = $("#sin-limite");
  const wrapMax = $("#umbral-max-wrap");
  const rngMax = $("#umbral-max");
  const lblMax = $("#umbral-max-val");
  const accBody = $("#acc-body");
  const accToggle = $("#acc-toggle");
  const accClose = $("#acc-close");
  const cryptoList = $("#crypto-list");
  const ledVerde = $("#led-verde");
  const ledRojo = $("#led-rojo");
  const btnStart = $("#btn-start");
  const btnStop = $("#btn-stop");
  const btnClear = $("#btn-clear");
  const btnSonido = $("#btn-sonido");
  const tbody = $("#tabla-registros");
  const countdownEl = $("#countdown");

  // ======= Inicio =======
  function init() {
    lblIntervalo.textContent = INTERVALOS[EC.intervaloIdx];
    lblMin.textContent = EC.umbralMin + "%";
    lblMax.textContent = "∞";
    rngMin.value = EC.umbralMin;
    rngMax.value = 100;
    renderCryptoChecks();
    restoreFromStorage();
    refreshCryptoChecksFromSet();

    btnPrev.addEventListener("click", () => stepInterval(-1));
    btnNext.addEventListener("click", () => stepInterval(+1));
    rngMin.addEventListener("input", () => {
      EC.umbralMin = Number(rngMin.value);
      lblMin.textContent = EC.umbralMin + "%";
      persistConfig();
    });
    chkInf.addEventListener("change", () => {
      if (chkInf.checked) {
        EC.umbralMax = Infinity;
        wrapMax.style.display = "none";
        lblMax.textContent = "∞";
      } else {
        EC.umbralMax = Number(rngMax.value);
        wrapMax.style.display = "flex";
        lblMax.textContent = EC.umbralMax + "%";
      }
      persistConfig();
    });
    rngMax.addEventListener("input", () => {
      EC.umbralMax = Number(rngMax.value);
      lblMax.textContent = EC.umbralMax + "%";
      persistConfig();
    });

    accToggle.addEventListener("click", toggleAccordion);
    accClose.addEventListener("click", () => setAccordion(false));
    btnStart.addEventListener("click", start);
    btnStop.addEventListener("click", stop);
    btnClear.addEventListener("click", clearRegistros);
    btnSonido.addEventListener("click", toggleSonido);

    if (countdownEl) countdownEl.textContent = "--";
  }

  function stepInterval(dir) {
    EC.intervaloIdx = (EC.intervaloIdx + dir + INTERVALOS.length) % INTERVALOS.length;
    lblIntervalo.textContent = INTERVALOS[EC.intervaloIdx];
    persistConfig();
  }

  function toggleAccordion() {
    const open = accBody.style.display !== "block";
    setAccordion(open);
  }

  function setAccordion(open) {
    accBody.style.display = open ? "block" : "none";
    accToggle.textContent = open ? "Cerrar" : "Abrir";
  }

  function renderCryptoChecks() {
    cryptoList.innerHTML = "";
    CRYPTOS.forEach(sym => {
      const id = "chk_" + sym;
      const label = document.createElement("label");
      label.innerHTML = `<input type="checkbox" id="${id}" data-sym="${sym}"> ${sym}/USDT`;
      cryptoList.appendChild(label);
    });
    cryptoList.addEventListener("change", (e) => {
      const el = e.target;
      if (el && el.matches("input[type=checkbox]")) {
        const s = el.getAttribute("data-sym");
        if (el.checked) EC.seleccionadas.add(s);
        else EC.seleccionadas.delete(s);
        persistConfig();
      }
    });
  }

  function refreshCryptoChecksFromSet() {
    CRYPTOS.forEach(sym => {
      const el = document.getElementById("chk_" + sym);
      if (el) el.checked = EC.seleccionadas.has(sym);
    });
  }

  // 🔴 Semáforo con apagado “off”
  function setSemaforo(tipo) {
    ledVerde.classList.remove("verde");
    ledRojo.classList.remove("roja");
    if (tipo === "alcista") ledVerde.classList.add("verde");
    else if (tipo === "bajista") ledRojo.classList.add("roja");
  }

  function beep(tipo = "alcista") {
    if (!EC.sonidoActivo) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sawtooth";
      o.frequency.value = (tipo === "alcista") ? 780 : 630;

      g.gain.setValueAtTime(1.0, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
      o.start();
      o.stop(ctx.currentTime + 1.5);
    } catch (e) {
      console.warn("⚠️ Error al reproducir el sonido:", e);
    }
  }

  function toggleSonido() {
    EC.sonidoActivo = !EC.sonidoActivo;
    btnSonido.textContent = EC.sonidoActivo ? "🔊 Sonido: ON" : "🔈 Sonido: OFF";
    persistConfig();
  }

  function clearRegistros() {
    tbody.innerHTML = "";
    localStorage.removeItem("EC_registros");
  }

  function persistConfig() {
    const data = {
      sonido: EC.sonidoActivo,
      intIdx: EC.intervaloIdx,
      uMin: EC.umbralMin,
      uMax: EC.umbralMax,
      sel: Array.from(EC.seleccionadas)
    };
    localStorage.setItem("EC_cfg", JSON.stringify(data));
  }

  function restoreFromStorage() {
    try {
      const raw = localStorage.getItem("EC_cfg");
      if (!raw) return;
      const cfg = JSON.parse(raw);
      EC.sonidoActivo = !!cfg.sonido;
      btnSonido.textContent = EC.sonidoActivo ? "🔊 Sonido: ON" : "🔈 Sonido: OFF";
      if (Number.isInteger(cfg.intIdx)) EC.intervaloIdx = cfg.intIdx;
      if (typeof cfg.uMin === "number") {
        EC.umbralMin = cfg.uMin;
        rngMin.value = EC.umbralMin;
        lblMin.textContent = EC.umbralMin + "%";
      }
      if (typeof cfg.uMax === "number") {
        EC.umbralMax = cfg.uMax;
        if (isFinite(EC.umbralMax)) {
          chkInf.checked = false; wrapMax.style.display = "flex";
          rngMax.value = EC.umbralMax; lblMax.textContent = EC.umbralMax + "%";
        } else {
          chkInf.checked = true; wrapMax.style.display = "none"; lblMax.textContent = "∞";
        }
      }
      if (Array.isArray(cfg.sel)) EC.seleccionadas = new Set(cfg.sel);
      lblIntervalo.textContent = INTERVALOS[EC.intervaloIdx];
    } catch (e) { }
  }

  // 🕒 Cuenta atrás
  function startCountdown() {
    if (!countdownEl) return;
    clearInterval(EC.countdownTimer);
    EC.countdownValue = Math.floor(FETCH_INTERVAL_MS / 1000);
    countdownEl.textContent = EC.countdownValue + "s";

    EC.countdownTimer = setInterval(() => {
      if (!EC.running) return;
      EC.countdownValue--;
      if (EC.countdownValue < 0) EC.countdownValue = Math.floor(FETCH_INTERVAL_MS / 1000);
      countdownEl.textContent = EC.countdownValue + "s";
      countdownEl.style.color = (EC.countdownValue <= 5) ? "var(--accent-2)" : "var(--accent)";
    }, 1000);
  }

  // ======= Bucle principal =======
  async function tick() {
    if (!EC.running) return;
    startCountdown();
    const interval = INTERVALOS[EC.intervaloIdx];
    const statusText = document.getElementById("status-text");
    if (statusText) statusText.innerHTML = "";

    for (const base of Array.from(EC.seleccionadas)) {
      const symbol = base + "USDT";
      try {
        const res = await window.EC_fetchLatestStats(symbol, interval);
        if (!res) continue;

        const { changePct, tipo, openTime, openPrice, high, low, closePrice, volume, volAvg } = res;
        const hora = new Date().toLocaleTimeString();

        let nivelVolumen = "normal";
        if (volume >= volAvg * 2) nivelVolumen = "alto";
        else if (volume < volAvg * 1.2) nivelVolumen = "bajo";

        if (statusText) {
          let msg = `Analizando ${base} ${interval} ${hora} — Oscilación (${changePct.toFixed(3)}%)`;
          if (nivelVolumen === "alto") msg += " 💥 Volumen MUY ALTO";
          else if (nivelVolumen === "bajo") msg += " 🔹 Volumen bajo";
          statusText.innerHTML += msg + "<br>";
        }

        const minOk = changePct >= EC.umbralMin || changePct <= -EC.umbralMin;
        const maxOk = !isFinite(EC.umbralMax) ? true : (Math.abs(changePct) <= EC.umbralMax);
        const key = symbol + "_" + openTime;

        if (minOk && maxOk && tipo) {
          if (!EC.lastAlertKey[key]) {
            EC.lastAlertKey[key] = true;
            setSemaforo(tipo);
            beep(tipo);
            addRegistro({
              symbol, interval, hora, changePct, tipo,
              open: openPrice, high, low, close: closePrice,
              volume, volAvg, nivelVolumen
            });
          }
        }
      } catch (err) {
        console.error("❌ Error al analizar", base, err);
      }
    }
  }

  // 🟢 Añadir filas con volumen
  function addRegistro({ symbol, interval, hora, changePct, tipo, open, high, low, close, volume, volAvg, nivelVolumen }) {
    if (!tbody) return;
    const tr = document.createElement("tr");
    tr.classList.add("new");
    const extra = nivelVolumen === "alto" ? "💥" : (nivelVolumen === "bajo" ? "🔹" : "⚡");
    tr.innerHTML = `
      <td>${symbol}</td>
      <td>${interval}</td>
      <td>${hora}</td>
      <td>${changePct.toFixed(3)}%</td>
      <td>${tipo} ${extra}</td>
      <td>${open?.toFixed(3) ?? "—"}</td>
      <td>${high?.toFixed(3) ?? "—"}/${low?.toFixed(3) ?? "—"}</td>
      <td>${close?.toFixed(3) ?? "—"}</td>
      <td>${volume?.toLocaleString(undefined, { maximumFractionDigits: 3 }) ?? "—"}</td>
      <td>${volAvg?.toLocaleString(undefined, { maximumFractionDigits: 3 }) ?? "—"}</td>
    `;
    tbody.prepend(tr);
  }

  // 🟢 Controles start/stop
  function start() {
    if (EC.running) return;
    EC.running = true;
    setSemaforo("off");
    tick();
    EC.timer = setInterval(tick, FETCH_INTERVAL_MS);
    startCountdown();
  }

  function stop() {
    EC.running = false;
    if (EC.timer) { clearInterval(EC.timer); EC.timer = null; }
    clearInterval(EC.countdownTimer);
    setSemaforo("off");
    const statusText = document.getElementById("status-text");
    if (statusText) statusText.textContent = "Preparado para analizar...";
    if (countdownEl) countdownEl.textContent = "--";
  }

  // === Inicialización ===
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})(); // ✅ Cierre final IIFE

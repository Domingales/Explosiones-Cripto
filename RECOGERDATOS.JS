// ================= RECOGERDATOS.JS =================
// Versión adaptada a Explosiones Criptos V1.0
// Igual método que la app CriptoAnalisis del alma (fetch directo limpio a Binance)

// ---------------------------------------------------
// 🔧 Función principal: obtiene velas OHLCV desde Binance
// ---------------------------------------------------
(async () => {
  const API_URL = "https://api.binance.com/api/v3/klines";

  /**
   * Obtiene las velas recientes de una cripto en un intervalo dado.
   * @param {string} symbol - símbolo (ej: "BTCUSDT")
   * @param {string} interval - intervalo Binance (ej: "15m")
   * @param {number} limit - número de velas (por defecto 60)
   */
  async function fetchKlines(symbol, interval, limit = 60) {
    try {
      const url = `${API_URL}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      const resp = await fetch(url); // ✅ Fetch directo, sin cabeceras ni modos
      if (!resp.ok) throw new Error("Error al obtener datos de Binance");
      const data = await resp.json();
      return data;
    } catch (err) {
      console.warn("⚠️ Error al recoger datos de Binance:", err);
      return null;
    }
  }

  /**
   * Transforma los datos crudos en objetos OHLC.
   * @param {Array} k - Array [openTime, open, high, low, close, volume, closeTime, ...]
   */
  function parseKline(k) {
    return {
      openTime: Number(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: Number(k[6])
    };
  }

  function avg(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /**
   * 📈 Obtiene y analiza la última vela cerrada (con contexto previo)
   * para detectar posibles “explosiones”.
   */
  async function getLatestStats(symbol, interval) {
    try {
      const raw = await fetchKlines(symbol, interval, 60);
      if (!raw || raw.length < 20) return null;

      const klines = raw.map(parseKline);
      const last = klines[klines.length - 1];
      const now = Date.now();
      const isClosed = now >= last.closeTime;
      const idx = isClosed ? klines.length - 1 : klines.length - 2;

      const cur = klines[idx];
      const prevs = klines.slice(idx - 10, idx);

      // Promedio de volumen y rangos previos
      const volAvg = avg(prevs.map(k => k.volume));
      const prevHigh = Math.max(...prevs.map(k => k.high));
      const prevLow = Math.min(...prevs.map(k => k.low));

      const open = cur.open;
      const close = cur.close;
      const high = cur.high;
      const low = cur.low;
      const vol = cur.volume;

      const changePct = ((close - open) / open) * 100;
      const green = close > open;
      const red = close < open;
      const volHigh = vol > volAvg * 1.5; // volumen anómalo

      const breakoutUp = close >= prevHigh * 1.005;
      const breakoutDown = close <= prevLow * 0.995;

      let tipo = null;
      if (green && volHigh && breakoutUp) tipo = "alcista";
      else if (red && volHigh && breakoutDown) tipo = "bajista";

      return {
        symbol,
        openTime: cur.openTime,
        openPrice: open,
        high,
        low,
        closePrice: close,
        volume: vol,
        volAvg,
        changePct,
        tipo
      };
    } catch (err) {
      console.error("❌ Error procesando datos de Binance:", err);
      return null;
    }
  }

  // ---------------------------------------------------
  // 🌍 Exponer función global para la app
  // ---------------------------------------------------
  window.EC_fetchLatestStats = getLatestStats;

  // ---------------------------------------------------
  // 🧩 Nota:
  // Este método usa el mismo tipo de fetch que la app CriptoAnalisis:
  // - Sin 'mode:no-cors'
  // - Sin cabeceras personalizadas
  // - Sin necesidad de proxy
  // Funciona correctamente en PC, WebIntoApp, y APK
  // ---------------------------------------------------
})();

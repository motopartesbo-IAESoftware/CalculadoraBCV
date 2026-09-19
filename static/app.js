/* Calculadora BCV · lógica del lado del cliente */

(function () {
  "use strict";

  const state = {
    rate: null,
    direction: "usd-bs", // usd-bs | bs-usd
    formatters: {},
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    refresh: $("btn-refresh"),
    status: $("status-chip"),
    tasa: $("tasa-value"),
    meta: $("tasa-meta"),
    swap: $("btn-swap"),
    currencyFrom: $("currency-from"),
    currencyTo: $("currency-to"),
    amountFrom: $("amount-from"),
    amountTo: $("amount-to"),
    hint: $("result-hint"),
    snackbar: $("snackbar"),
  };

  function nf(digits) {
    const key = digits || 2;
    if (!state.formatters[key]) {
      state.formatters[key] = new Intl.NumberFormat("es-VE", {
        minimumFractionDigits: digits === null ? 0 : 2,
        maximumFractionDigits: digits === null ? 2 : digits,
      });
    }
    return state.formatters[key];
  }

  function fmtTasa(value) {
    // Hasta 8 decimales para la tasa completa
    return nf(8).format(value);
  }

  function fmtMoneda(value) {
    // 2 decimales para resultados monetarios
    return nf(2).format(value);
  }

  function setStatus(text, cls) {
    els.status.textContent = text;
    els.status.className = "chip chip--status" + (cls ? " " + cls : "");
  }

  function formatDateTime(s) {
    if (!s) return "";
    const d = new Date(s.replace(" ", "T"));
    if (isNaN(d.getTime())) return s;
    try {
      return d.toLocaleString("es-VE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return s;
    }
  }

  function showSnack(msg) {
    els.snackbar.textContent = msg;
    els.snackbar.classList.add("show");
    clearTimeout(showSnack._t);
    showSnack._t = setTimeout(() => els.snackbar.classList.remove("show"), 3200);
  }

  async function fetchTasa() {
    // 1) Backend local (Python de D:\CalculadoraBCV)  -> en vivo
    // 2) Archivo data/tasa.json (GitHub Pages)         -> dato guardado
    const base = document.baseURI;
    const sources = [
      { url: new URL("api/tasa", base).href, source: "vivo" },
      { url: new URL("data/tasa.json", base).href, source: "guardado" },
    ];
    let lastError = null;
    for (const s of sources) {
      try {
        const res = await fetch(s.url);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (data && data.dolar !== undefined) {
          data._source = s.source;
          return data;
        }
        throw new Error("JSON sin tasa");
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error("Sin fuentes de tasa");
  }

  async function loadRate(manual, auto) {
    els.refresh.classList.add("spinning");
    setStatus("Consultando…");
    try {
      const data = await fetchTasa();

      const tasa = Number(data.dolar);
      if (!isFinite(tasa) || tasa <= 0) throw new Error("Tasa no válida recibida");

      state.rate = tasa;
      const fecha = data.fecha_valor || data.fecha_actualizacion || null;
      const consulta = data.consulta || "";
      const horaVerificacion = formatDateTime(consulta);
      const enVivo = data._source === "vivo";

      els.tasa.innerHTML = "Bs. " + fmtTasa(tasa) + " <small>por USD 1</small>";
      if (enVivo) {
        const base = fecha
          ? "Tipo de cambio de referencia · " + fecha
          : "Tipo de cambio · consultado hoy";
        els.meta.textContent = horaVerificacion
          ? base + " · Última verificación: " + horaVerificacion
          : base;
      } else {
        els.meta.textContent =
          "Tasa del: " + (fecha || consulta || "dato guardado") +
          (horaVerificacion ? " · Última verificación: " + horaVerificacion : "") +
          " · actualízala con el botón 🔄 o abre el sitio del BCV";
      }
      setStatus(enVivo ? "En vivo" : "Guardada", "ok");
      if (manual) {
        if (enVivo) {
          if (auto) {
            showSnack("Última verificación del BCV: " + (horaVerificacion || consulta || "hoy"));
          } else {
            showSnack("Tasa actualizada en vivo desde el BCV");
          }
        } else {
          showSnack("Mostrando la última tasa guardada. La versión web se actualiza varias veces al día.");
        }
      }
      update();
    } catch (e) {
      setStatus("Sin conexión", "err");
      els.tasa.textContent = "—";
      els.meta.textContent = "No se pudo obtener la tasa del BCV.";
      showSnack("Sin conexión. Revisa tu internet e intenta de nuevo.");
      console.error(e);
    } finally {
      els.refresh.classList.remove("spinning");
    }
  }

  function parseAmount(raw) {
    if (!raw || raw.trim() === "") return null;
    let s = raw.trim().replace(/\s/g, "").replace(/\.$/g, "");
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (/^\d+(,\d+)?$/.test(s)) {
      s = s.replace(",", ".");
    }
    const n = Number(s);
    return isFinite(n) && n >= 0 ? n : null;
  }

  function setDirection(dir) {
    state.direction = dir;
    els.currencyFrom.textContent = dir === "usd-bs" ? "USD" : "Bs.";
    els.currencyTo.textContent = dir === "usd-bs" ? "Bs." : "USD";
    els.amountFrom.placeholder = dir === "usd-bs" ? "0,00" : "0,00";
    update();
  }

  function update() {
    if (state.rate === null) return;
    const amount = parseAmount(els.amountFrom.value);
    if (amount === null || amount === 0) {
      els.amountTo.value = "";
      els.hint.textContent = "Ingresa un monto para convertir.";
      return;
    }

    const isUsdToBs = state.direction === "usd-bs";
    const result = isUsdToBs ? amount * state.rate : amount / state.rate;
    const fromSymbol = isUsdToBs ? "$" : "Bs.";
    const toSymbol = isUsdToBs ? "Bs." : "$";

    els.amountTo.value = fmtMoneda(result).replace(/\./g, ",");
    els.hint.textContent =
      fromSymbol + " " + fmtMoneda(amount) + " × " + fmtTasa(state.rate) +
      " = " + toSymbol + " " + fmtMoneda(result);
  }

  function swap() {
    const current = els.amountFrom.value;
    const nextDir = state.direction === "usd-bs" ? "bs-usd" : "usd-bs";
    els.amountFrom.value = els.amountTo.value; // conserva el valor convertido
    setDirection(nextDir);
    els.amountFrom.focus();
    if (current && !els.amountFrom.value) {
      showSnack("Valor convertido colocado en el campo de monto.");
    }
  }

  // Eventos
  els.refresh.addEventListener("click", () => loadRate(true));
  els.swap.addEventListener("click", swap);
  els.amountFrom.addEventListener("input", update);
  els.amountFrom.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); els.amountFrom.blur(); }
  });

  // Inicio
  setDirection("usd-bs");
  loadRate(false);

  // Verificar la tasa del BCV automáticamente cada 30 minutos
  setInterval(() => loadRate(true, true), 30 * 60 * 1000);
})();
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

  function showSnack(msg) {
    els.snackbar.textContent = msg;
    els.snackbar.classList.add("show");
    clearTimeout(showSnack._t);
    showSnack._t = setTimeout(() => els.snackbar.classList.remove("show"), 3200);
  }

  async function loadRate(manual) {
    els.refresh.classList.add("spinning");
    setStatus("Consultando BCV…");
    try {
      const res = await fetch("/api/tasa");
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Error del servidor");

      const tasa = Number(data.dolar);
      if (!isFinite(tasa) || tasa <= 0) throw new Error("Tasa no válida recibida");

      state.rate = tasa;
      const fecha = data.fecha_valor || data.fecha_actualizacion || null;

      els.tasa.innerHTML = "Bs. " + fmtTasa(tasa) + " <small>por USD 1</small>";
      els.meta.textContent = fecha
        ? "Tipo de cambio de referencia · " + fecha
        : "Tipo de cambio de referencia · consultado hoy";
      setStatus("Actualizada", "ok");
      if (manual) showSnack("Tasa actualizada correctamente");
      update();
    } catch (e) {
      setStatus("Sin conexión", "err");
      els.meta.textContent = "No se pudo obtener la tasa del BCV.";
      showSnack("No se pudo conectar con el BCV. Revisa tu conexión e inténtalo de nuevo.");
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
})();
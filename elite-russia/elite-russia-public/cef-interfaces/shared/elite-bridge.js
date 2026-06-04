(function () {
  "use strict";

  const nativeSend = window.sendClientEvent;

  function safeJson(value) {
    try {
      return JSON.stringify(value || {});
    } catch (error) {
      return "{}";
    }
  }

  window.EliteBridge = {
    emit(eventName, payload) {
      if (!eventName || typeof eventName !== "string") {
        return false;
      }

      const body = safeJson(payload);

      if (typeof nativeSend === "function") {
        nativeSend(eventName, body);
        return true;
      }

      // Browser preview fallback.
      console.log("[EliteBridge]", eventName, payload || {});
      return false;
    }
  };

  window.EliteInterfaces = {
    open(name, data) {
      document.documentElement.dataset.interface = name || "";
      window.dispatchEvent(new CustomEvent("elite:open", {
        detail: { name, data: data || {} }
      }));
    },

    close(name) {
      window.dispatchEvent(new CustomEvent("elite:close", {
        detail: { name }
      }));
    }
  };
})();

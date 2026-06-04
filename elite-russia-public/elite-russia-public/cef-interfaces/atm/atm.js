(function () {
  "use strict";

  const pin = document.getElementById("pin");
  const status = document.getElementById("status");

  document.querySelectorAll("[data-action]").forEach(function (button) {
    button.addEventListener("click", function () {
      window.EliteBridge.emit("OnAtmAction", {
        action: button.dataset.action,
        pin: pin.value
      });
    });
  });

  window.Atm = {
    setStatus(text) {
      status.textContent = text || "";
    },

    setTheme(color) {
      document.documentElement.style.setProperty("--er-orange", color || "#ff9e3f");
    }
  };
})();

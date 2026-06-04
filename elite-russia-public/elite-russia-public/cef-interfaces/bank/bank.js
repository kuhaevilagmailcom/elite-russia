(function () {
  "use strict";

  const cash = document.getElementById("cash");
  const balance = document.getElementById("balance");
  const history = document.getElementById("history");

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("ru-RU") + " ₽";
  }

  function renderHistory(items) {
    history.innerHTML = "";

    (items || []).forEach(function (item) {
      const row = document.createElement("div");
      row.className = "bank-history-row";
      row.innerHTML = "<span></span><strong></strong>";
      row.children[0].textContent = item.title || "Операция";
      row.children[1].textContent = formatMoney(item.amount);
      history.appendChild(row);
    });
  }

  document.querySelectorAll("[data-action]").forEach(function (button) {
    button.addEventListener("click", function () {
      window.EliteBridge.emit("OnBankAction", {
        action: button.dataset.action
      });
    });
  });

  window.Bank = {
    setState(data) {
      cash.textContent = formatMoney(data && data.cash);
      balance.textContent = formatMoney(data && data.balance);
      renderHistory(data && data.history);
    }
  };

  window.Bank.setState({
    cash: 25000,
    balance: 125000,
    history: [
      { title: "Пополнение", amount: 5000 },
      { title: "Перевод", amount: -12000 }
    ]
  });
})();

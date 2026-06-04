(function () {
  "use strict";

  const money = document.getElementById("money");
  const bank = document.getElementById("bank");
  const hp = document.getElementById("hp");
  const armour = document.getElementById("armour");
  const hunger = document.getElementById("hunger");

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("ru-RU") + " ₽";
  }

  window.Hud = {
    setState(data) {
      money.textContent = formatMoney(data && data.money);
      bank.textContent = formatMoney(data && data.bank);
      hp.value = Number(data && data.hp || 0);
      armour.value = Number(data && data.armour || 0);
      hunger.value = Number(data && data.hunger || 0);
    },

    setMoney(value) {
      money.textContent = formatMoney(value);
    },

    setVisible(state) {
      document.querySelector(".hud").hidden = !state;
    }
  };

  window.Hud.setState({
    money: 45000,
    bank: 120000,
    hp: 94,
    armour: 55,
    hunger: 72
  });
})();

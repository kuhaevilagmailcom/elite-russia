(function () {
  "use strict";

  const grid = document.getElementById("grid");
  const confirm = document.getElementById("confirm");

  const defaultSkins = [
    { slot: 0, modelId: 23, name: "Street 01", image: "" },
    { slot: 1, modelId: 29, name: "Street 02", image: "" },
    { slot: 2, modelId: 250, name: "Casual", image: "" },
    { slot: 3, modelId: 299, name: "Classic", image: "" },
    { slot: 4, modelId: 12, name: "Female 01", image: "" },
    { slot: 5, modelId: 40, name: "Female 02", image: "" },
    { slot: 6, modelId: 55, name: "Urban", image: "" },
    { slot: 7, modelId: 170, name: "Worker", image: "" }
  ];

  let skins = defaultSkins.slice();
  let selected = skins[0];

  function render() {
    grid.innerHTML = "";

    skins.forEach(function (skin) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "skin-card" + (selected.modelId === skin.modelId ? " is-active" : "");

      const photo = document.createElement("div");
      photo.className = "skin-photo";
      photo.textContent = skin.image ? "" : "model " + skin.modelId;

      if (skin.image) {
        photo.style.backgroundImage = "url('" + skin.image + "')";
        photo.style.backgroundSize = "contain";
        photo.style.backgroundRepeat = "no-repeat";
        photo.style.backgroundPosition = "center bottom";
      }

      const name = document.createElement("div");
      name.className = "skin-name";
      name.textContent = skin.name;

      const meta = document.createElement("div");
      meta.className = "skin-meta";
      meta.textContent = "slot " + skin.slot + " · modelId " + skin.modelId;

      card.append(photo, name, meta);

      card.addEventListener("click", function () {
        selected = skin;
        window.EliteBridge.emit("OnRegistrationSkinPreview", {
          slot: skin.slot,
          modelId: skin.modelId
        });
        render();
      });

      grid.appendChild(card);
    });
  }

  confirm.addEventListener("click", function () {
    window.EliteBridge.emit("OnRegistrationSkin", {
      slot: selected.slot,
      modelId: selected.modelId
    });
  });

  window.Skins = {
    setSkins(list) {
      if (Array.isArray(list) && list.length > 0) {
        skins = list.filter(function (item) {
          return typeof item.modelId === "number";
        });
        selected = skins[0] || defaultSkins[0];
        render();
      }
    },

    getSelected() {
      return selected;
    }
  };

  render();
})();

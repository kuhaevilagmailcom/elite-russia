(function () {
  "use strict";

  const nickname = document.getElementById("nickname");
  const password = document.getElementById("password");
  const gender = document.getElementById("gender");
  const submit = document.getElementById("submit");
  const message = document.getElementById("message");

  function setMessage(text, isError) {
    message.textContent = text;
    message.style.color = isError ? "var(--er-danger)" : "var(--er-muted)";
  }

  submit.addEventListener("click", function () {
    const nick = nickname.value.trim();
    const pass = password.value;

    if (!nick || !pass) {
      setMessage("Заполните никнейм и пароль.", true);
      return;
    }

    window.EliteBridge.emit("OnRegistrationSubmit", {
      nickname: nick,
      password: pass,
      gender: gender.value
    });

    setMessage("Данные отправлены.", false);
  });

  window.Registration = {
    setError(text) {
      setMessage(text || "Ошибка регистрации.", true);
    }
  };
})();

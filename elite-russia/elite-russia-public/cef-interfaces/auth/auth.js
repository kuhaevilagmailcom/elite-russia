(function () {
  "use strict";

  const nickname = document.getElementById("nickname");
  const password = document.getElementById("password");
  const submit = document.getElementById("submit");
  const message = document.getElementById("message");

  function setMessage(text, isError) {
    message.textContent = text;
    message.style.color = isError ? "var(--er-danger)" : "var(--er-muted)";
  }

  function send() {
    const nick = nickname.value.trim();
    const pass = password.value;

    if (!nick || !pass) {
      setMessage("Заполните никнейм и пароль.", true);
      return;
    }

    window.EliteBridge.emit("OnAuthorizationSubmit", {
      nickname: nick,
      password: pass
    });

    setMessage("Отправляем данные...", false);
  }

  submit.addEventListener("click", send);

  window.Authorization = {
    setError(text) {
      setMessage(text || "Ошибка авторизации.", true);
    },

    setLoading(state) {
      submit.disabled = Boolean(state);
      submit.textContent = state ? "Проверяем..." : "Войти";
    }
  };
})();

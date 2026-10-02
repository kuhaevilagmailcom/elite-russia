(()=>{
  window.__PEREKUP_BOOT_DONE=false;
  const render=(title,detail)=>{
    if(window.__PEREKUP_BOOT_DONE)return;
    const root=document.getElementById('app');if(!root)return;
    root.innerHTML='<div class="boot"><div class="boot-logo">⚠️</div><b>'+title+'</b><span>'+detail+'</span><button id="bootRetry" style="margin-top:18px;border:0;border-radius:12px;padding:12px 18px;background:#11151d;color:#fff;font-weight:700">Повторить</button></div>';
    document.getElementById('bootRetry')?.addEventListener('click',()=>location.reload());
  };
  window.addEventListener('error',e=>render('Ошибка запуска','Не удалось загрузить приложение. Нажми «Повторить».'));
  window.addEventListener('unhandledrejection',()=>render('Ошибка соединения','Не удалось получить данные. Нажми «Повторить».'));
  setTimeout(()=>render('Слишком долгая загрузка','Сервер не ответил вовремя. Нажми «Повторить».'),12000);
})();
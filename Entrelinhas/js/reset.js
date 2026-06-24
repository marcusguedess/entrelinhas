(async () => {
  const status = document.getElementById('reset-status');
  const write = (message) => {
    status.textContent = message;
  };

  try {
    write('Removendo service workers antigos...');
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    write('Limpando caches antigos...');
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith('entrelinhas-')).map((name) => caches.delete(name))
      );
    }

    write('Cache limpo. Reabrindo o aplicativo...');
    window.setTimeout(() => {
      window.location.replace(`./index.html?fresh=${Date.now()}`);
    }, 900);
  } catch {
    write(
      'Não foi possível limpar automaticamente. Use Ctrl+F5 ou limpe os dados do site no navegador.'
    );
  }
})();

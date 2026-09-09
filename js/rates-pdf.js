(() => {
  const button = document.getElementById('pdfBtn');
  const search = document.getElementById('search');
  if (!button) return;

  button.addEventListener('click', async () => {
    const previousSearch = search?.value || '';
    if (search) {
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const images = [...document.querySelectorAll('.bill')];
    images.forEach(img => { img.loading = 'eager'; });
    await Promise.allSettled(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 5000);
      });
    }));

    const oldTitle = document.title;
    document.title = 'America-es-Tuya-Tasas-de-cambio';
    window.print();
    document.title = oldTitle;

    if (search && previousSearch) {
      search.value = previousSearch;
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
})();
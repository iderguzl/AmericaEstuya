// AmericaEsTuya location helper
// Starts with approximate IP location. Precise device location is requested only after user action.
(function () {
  const btn = document.getElementById('locationBtn');
  const label = document.getElementById('locationLabel');
  if (!btn || !label) return;

  const setLabel = (text, title) => {
    label.textContent = text;
    btn.title = title || text;
    btn.setAttribute('aria-label', title || text);
  };

  async function loadApproximateLocation() {
    setLabel('Ubicando…', 'Buscando ubicación aproximada');
    try {
      const r = await fetch('https://ipapi.co/json/');
      if (!r.ok) throw new Error('IP location failed');
      const j = await r.json();
      const parts = [j.city, j.region_code || j.region, j.country_name].filter(Boolean);
      setLabel(parts.join(', ') || 'Ubicación aproximada', 'Ubicación aproximada por IP. Toca para intentar ubicación precisa.');
      localStorage.setItem('americaestuya_location_mode', 'ip');
      if (Number.isFinite(j.latitude) && Number.isFinite(j.longitude)) {
        localStorage.setItem('americaestuya_location_lat', String(j.latitude));
        localStorage.setItem('americaestuya_location_lon', String(j.longitude));
      }
    } catch (_) {
      setLabel('Mi ubicación', 'Toca para intentar ubicación precisa');
    }
  }

  function requestPreciseLocation() {
    if (!navigator.geolocation) {
      loadApproximateLocation();
      return;
    }
    setLabel('Buscando GPS…', 'Solicitando ubicación precisa');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy || 0);
        setLabel(`${lat.toFixed(5)}, ${lon.toFixed(5)}`, `Ubicación precisa del dispositivo${acc ? ` · ±${acc} m` : ''}`);
        localStorage.setItem('americaestuya_location_mode', 'gps');
        localStorage.setItem('americaestuya_location_lat', String(lat));
        localStorage.setItem('americaestuya_location_lon', String(lon));
        localStorage.setItem('americaestuya_location_accuracy', String(acc));
      },
      () => loadApproximateLocation(),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  btn.addEventListener('click', requestPreciseLocation);
  loadApproximateLocation();
})();

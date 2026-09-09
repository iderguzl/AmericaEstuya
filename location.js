// AmericaEsTuya location helper
// Starts with approximate IP location. Precise device location is requested only after user action.
(function () {
  const btn = document.getElementById('locationBtn');
  const mapBtn = document.getElementById('locationMapBtn');
  const label = document.getElementById('locationLabel');
  if (!btn || !label) return;

  const setLabel = (text, title) => {
    label.textContent = text;
    btn.title = title || text;
    btn.setAttribute('aria-label', title || text);
  };

  const saveCoords = (lat, lon, mode, accuracy) => {
    localStorage.setItem('americaestuya_location_mode', mode);
    localStorage.setItem('americaestuya_location_lat', String(lat));
    localStorage.setItem('americaestuya_location_lon', String(lon));
    if (accuracy != null) localStorage.setItem('americaestuya_location_accuracy', String(accuracy));
  };

  const openMap = () => {
    const lat = Number(localStorage.getItem('americaestuya_location_lat'));
    const lon = Number(localStorage.getItem('americaestuya_location_lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setLabel('Ubicación no disponible', 'Primero obtén tu ubicación');
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat + ',' + lon)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  async function loadApproximateLocation() {
    setLabel('Ubicando…', 'Buscando ubicación aproximada');
    try {
      const r = await fetch('https://ipapi.co/json/');
      if (!r.ok) throw new Error('IP location failed');
      const j = await r.json();
      const parts = [j.city, j.region_code || j.region, j.country_name].filter(Boolean);
      setLabel(parts.join(', ') || 'Ubicación aproximada', 'Ubicación aproximada por IP. Toca para intentar ubicación precisa.');
      if (Number.isFinite(j.latitude) && Number.isFinite(j.longitude)) {
        saveCoords(j.latitude, j.longitude, 'ip');
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
        setLabel('Ubicación exacta', `Ubicación precisa del dispositivo${acc ? ` · ±${acc} m` : ''}`);
        saveCoords(lat, lon, 'gps', acc);
      },
      () => loadApproximateLocation(),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  btn.addEventListener('click', requestPreciseLocation);
  if (mapBtn) mapBtn.addEventListener('click', openMap);
  loadApproximateLocation();
})();

// Garmin Tracker Data Field — live-data companion.
// Reads a trackId from the URL (or the input), queries the backend, renders
// the latest records and auto-refreshes every 5 minutes with a countdown.
window.addEventListener('DOMContentLoaded', function () {
  const targetDiv = document.getElementById("garminTrackerDataField");
  const inputField = document.getElementById("trackIdInput");
  const checkButton = document.getElementById("checkTrackingBtn");
  const autoUpdateMessage = document.getElementById("autoUpdateMessage");

  if (!targetDiv || !inputField || !checkButton) return;

  const ENDPOINT = "https://script.google.com/macros/s/AKfycbzlsxmcB-4w7LcuvJ1j-sHwJOBYGxREp74cNdaYdcD4zyHUUVXhYjh_Lcxc0W1M6yH4EA/exec";

  let currentTrackId = '';
  const REFRESH_MS = 5 * 60 * 1000; // 5 minutes
  let nextUpdateAt = 0;             // absolute timestamp of the next auto-refresh
  let countdownInterval = null;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderData(data) {
    if (!data || !data.result) {
      return '<p class="error">No data found. It may take up to 5 minutes until any data starts to show up.</p>';
    }

    if (typeof data.result === 'string') {
      return `<p class="error">${escapeHtml(data.result)}</p>`;
    }

    if (Array.isArray(data.result)) {
      if (data.result.length === 0) {
        return '<p class="error">No matching records found. It may take up to 10 minutes after you start recording your activity until any data starts to show up.</p>';
      }

      return data.result.map((record, idx) => {
        let dl = `<strong>Record ${idx + 1}</strong><dl>`;
        for (const [key, value] of Object.entries(record)) {
          dl += `<dt>${escapeHtml(key || '(no header)')}</dt><dd>${escapeHtml(value)}</dd>`;
        }
        dl += '</dl>';
        return dl;
      }).join('<hr>');
    }

    let dl = '<dl>';
    for (const [key, value] of Object.entries(data.result)) {
      dl += `<dt>${escapeHtml(key || '(no header)')}</dt><dd>${escapeHtml(value)}</dd>`;
    }
    dl += '</dl>';
    return dl;
  }

  async function fetchData(trackId) {
    if (!trackId.trim()) {
      targetDiv.innerHTML = '<p class="error">Please enter a valid Track ID.</p>';
      return;
    }
    targetDiv.innerHTML = '<p class="loading">Loading data...</p>';
    const url = `${ENDPOINT}?trackId=${encodeURIComponent(trackId)}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      targetDiv.innerHTML = renderData(data);
      if (autoUpdateMessage) autoUpdateMessage.style.display = 'block';
    } catch (error) {
      targetDiv.innerHTML = `<p class="error">Error: ${escapeHtml(error.message)}</p>`;
      if (autoUpdateMessage) autoUpdateMessage.style.display = 'none';
    }
  }

  function updateCountdownDisplay(secondsLeft) {
    if (!autoUpdateMessage) return;
    secondsLeft = Math.max(0, secondsLeft);
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    autoUpdateMessage.textContent =
      `Next update in ${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Drive the countdown from an absolute target timestamp rather than a
  // decrementing counter, so it stays correct even when the tab is
  // backgrounded and the 1s interval is throttled or paused. Each tick derives
  // the time left from `nextUpdateAt`; once it has passed (possibly while the
  // page was hidden) we refresh once and schedule the next update.
  function tick() {
    const secondsLeft = Math.round((nextUpdateAt - Date.now()) / 1000);
    if (secondsLeft <= 0) {
      nextUpdateAt = Date.now() + REFRESH_MS;
      updateCountdownDisplay(REFRESH_MS / 1000);
      fetchData(currentTrackId);
      return;
    }
    updateCountdownDisplay(secondsLeft);
  }

  function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    nextUpdateAt = Date.now() + REFRESH_MS;
    updateCountdownDisplay(REFRESH_MS / 1000);
    countdownInterval = setInterval(tick, 1000);
  }

  function startAutoRefresh(trackId) {
    currentTrackId = trackId;
    startCountdown();
  }

  // When the tab becomes visible again, re-evaluate the countdown immediately
  // (and refresh right away if the scheduled time passed while it was hidden),
  // instead of waiting for the next throttled interval tick.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && countdownInterval) tick();
  });

  checkButton.addEventListener('click', () => {
    const trackId = inputField.value.trim();
    if (!trackId) {
      targetDiv.innerHTML = '<p class="error">Please enter a valid Track ID.</p>';
      return;
    }

    const newURL = `${window.location.pathname}?trackId=${encodeURIComponent(trackId)}`;
    window.history.pushState({ trackId }, '', newURL);

    fetchData(trackId);
    startAutoRefresh(trackId);
  });

  inputField.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      checkButton.click();
    }
  });

  // Load trackId from the URL (if present).
  const urlParams = new URLSearchParams(window.location.search);
  const trackIdFromURL = urlParams.get('trackId');
  if (trackIdFromURL) {
    inputField.value = trackIdFromURL;
    fetchData(trackIdFromURL);
    startAutoRefresh(trackIdFromURL);
  }
});

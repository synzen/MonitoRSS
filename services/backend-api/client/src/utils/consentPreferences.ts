// Opens the Termly preference center from React-rendered UI.
// Termly binds its modal opener at page load to static HTML, so it misses
// buttons mounted later on client routes. Route through the hidden static
// trigger in index.html, with a direct API call first when available.
export function openConsentPreferences(event: { preventDefault: () => void }): void {
  event.preventDefault();
  const w = window as Window & { displayPreferenceModal?: () => void };

  if (typeof w.displayPreferenceModal === "function") {
    w.displayPreferenceModal();

    return;
  }

  document.getElementById("termly-pref-trigger")?.click();
}

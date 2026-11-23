// Apply the saved theme before first paint (dark unless the user picked light).
// A separate file rather than an inline <script> so the server's CSP allows it.
(function () {
  var t = 'dark';
  try { t = localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; } catch (e) {}
  document.documentElement.setAttribute('data-theme', t);
})();

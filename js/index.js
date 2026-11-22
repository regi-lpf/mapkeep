import { observeAuthState } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
  observeAuthState((user) => {
    if (user) {
      window.location.replace('trips.html');
    } else {
      window.location.replace('login.html');
    }
  });
});

import { auth, googleProvider, isFirebaseConfigured } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

const LOCAL_STORAGE_USER_KEY = 'mapKeepUser';

export async function signInWithGoogle() {
  if (isFirebaseConfigured && auth && googleProvider) {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.error('[MapKeep] Erro ao autenticar com Google:', error);
      throw error;
    }
  } else {
    // Modo local / demonstração enquanto as chaves do Firebase não forem preenchidas
    const demoUser = {
      uid: 'demo-user-123',
      displayName: 'Viajante Convidado',
      email: 'demo@mapkeep.local',
      photoURL: null,
    };
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(demoUser));
    return demoUser;
  }
}

export async function signOutUser() {
  if (isFirebaseConfigured && auth) {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('[MapKeep] Erro ao deslogar:', error);
    }
  }
  localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
  window.location.href = 'login.html';
}

export function observeAuthState(callback) {
  if (isFirebaseConfigured && auth) {
    return onAuthStateChanged(auth, (user) => {
      callback(user);
    });
  } else {
    const localUser = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
    const user = localUser ? JSON.parse(localUser) : null;
    callback(user);
    // Retorna unsubscribe no-op
    return () => {};
  }
}

export function updateHeaderUserUI(user) {
  const greetingEl = document.getElementById('user-greeting');
  const logoutBtn = document.getElementById('logout-button');

  if (greetingEl) {
    if (user) {
      const name = user.displayName ? user.displayName.split(' ')[0] : 'Viajante';
      greetingEl.innerHTML = `
        <span class="user-pill">
          ${user.photoURL ? `<img src="${user.photoURL}" alt="${name}" class="user-avatar">` : ''}
          Olá, <strong>${name}</strong>!
        </span>
      `;
    } else {
      greetingEl.textContent = '';
    }
  }

  if (logoutBtn) {
    logoutBtn.onclick = () => {
      signOutUser();
    };
  }
}

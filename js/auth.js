import { supabase, isSupabaseConfigured } from './supabase-config.js';

const LOCAL_STORAGE_USER_KEY = 'mapKeepUser';

/**
 * Normaliza o objeto de usuário do Supabase para um formato consistente
 */
function normalizeUser(supabaseUser) {
  if (!supabaseUser) return null;
  const meta = supabaseUser.user_metadata || {};
  return {
    uid: supabaseUser.id,
    id: supabaseUser.id,
    email: supabaseUser.email,
    displayName: meta.full_name || meta.name || supabaseUser.email?.split('@')[0] || 'Viajante',
    photoURL: meta.avatar_url || meta.picture || null,
  };
}

/**
 * Realiza login com Google via OAuth do Supabase
 */
export async function signInWithGoogle() {
  if (isSupabaseConfigured && supabase) {
    const redirectTo = window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'trips.html';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      console.error('[MapKeep] Erro ao autenticar com Google:', error);
      throw error;
    }
    return data;
  } else {
    // Modo local / demonstração
    const demoUser = {
      uid: 'demo-user-123',
      id: 'demo-user-123',
      displayName: 'Viajante Convidado',
      email: 'demo@mapkeep.local',
      photoURL: null,
    };
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(demoUser));
    return demoUser;
  }
}

/**
 * Encerra a sessão do usuário
 */
export async function signOutUser() {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('[MapKeep] Erro ao deslogar do Supabase:', error);
    }
  }
  localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
  window.location.href = 'login.html';
}

/**
 * Observa o estado de autenticação (sessão ativa, token refresh, login, logout)
 */
export function observeAuthState(callback) {
  if (isSupabaseConfigured && supabase) {
    // Verifica sessão imediatamente
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ? normalizeUser(session.user) : null;
      callback(user);
    });

    // Escuta mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ? normalizeUser(session.user) : null;
      callback(user);
    });

    return () => {
      subscription.unsubscribe();
    };
  } else {
    const localUser = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
    const user = localUser ? JSON.parse(localUser) : null;
    callback(user);
    return () => {};
  }
}

/**
 * Atualiza o cabeçalho com avatar e nome do usuário
 */
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

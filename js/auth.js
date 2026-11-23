import { supabase, isSupabaseConfigured } from './supabase-config.js';

const LOCAL_STORAGE_USER_KEY = 'mapKeepUser';

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
 * Login com Google.
 * Com Supabase configurado, o navegador é REDIRECIONADO para o Google
 * (a função retorna { redirecting: true } e a página NÃO deve navegar para outro lugar).
 * Em modo demo, cria um usuário local e retorna { redirecting: false }.
 */
export async function signInWithGoogle() {
  if (isSupabaseConfigured && supabase) {
    const baseDir = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    const redirectTo = baseDir + 'trips.html';

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      console.error('[MapKeep] Erro ao iniciar OAuth com Google:', error);
      throw error;
    }
    return { redirecting: true };
  }

  const demoUser = {
    uid: 'demo-user-123',
    id: 'demo-user-123',
    displayName: 'Viajante Convidado',
    email: 'demo@mapkeep.local',
    photoURL: null,
  };
  localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(demoUser));
  return { redirecting: false };
}

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
 * Observa o estado de autenticação.
 * O callback só é chamado quando o usuário realmente muda (login/logout),
 * evitando execuções duplicadas (getSession + INITIAL_SESSION + TOKEN_REFRESHED).
 */
export function observeAuthState(callback) {
  let lastUid; // undefined = ainda não emitiu

  const emit = (user) => {
    const uid = user ? user.uid : null;
    if (uid === lastUid) return;
    lastUid = uid;
    callback(user);
  };

  if (isSupabaseConfigured && supabase) {
    // onAuthStateChange emite INITIAL_SESSION já com a sessão resolvida
    // (inclusive a vinda do redirect do OAuth na URL).
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      emit(session?.user ? normalizeUser(session.user) : null);
    });
    return () => data.subscription.unsubscribe();
  }

  const localUser = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
  emit(localUser ? JSON.parse(localUser) : null);
  return () => {};
}

export function updateHeaderUserUI(user) {
  const greetingEl = document.getElementById('user-greeting');
  const logoutBtn = document.getElementById('logout-button');

  if (greetingEl) {
    if (user) {
      const name = user.displayName ? user.displayName.split(' ')[0] : 'Viajante';
      greetingEl.innerHTML = `
        <span class="user-pill">
          ${user.photoURL ? `<img src="${user.photoURL}" alt="${name}" class="user-avatar" referrerpolicy="no-referrer">` : ''}
          Olá, <strong>${name}</strong>!
        </span>
      `;
    } else {
      greetingEl.textContent = '';
    }
  }

  if (logoutBtn) {
    logoutBtn.onclick = () => signOutUser();
  }
}

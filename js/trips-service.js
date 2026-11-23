import { supabase, isSupabaseConfigured } from './supabase-config.js';
import { normalizeState } from './states.js';

const LOCAL_STORAGE_TRIPS_PREFIX = 'mapKeepTrips_';

const DEFAULT_DEMO_TRIPS = [
  {
    id: 't1',
    title: 'Praia do Francês',
    date: '2024-07-10',
    state: 'Alagoas',
    stateUf: 'AL',
    description: 'Dia de sol, mar cristalino e culinária nordestina incrível!',
    photos: ['https://placehold.co/600x400?text=Praia+do+Francês'],
  },
  {
    id: 't2',
    title: 'Centro de Palmas',
    date: '2023-11-05',
    state: 'Tocantins',
    stateUf: 'TO',
    description: 'Conhecendo a capital planejada e a Praça dos Girassóis.',
    photos: ['https://placehold.co/600x400?text=Palmas'],
  },
  {
    id: 't3',
    title: 'Pelourinho',
    date: '2024-01-20',
    state: 'Bahia',
    stateUf: 'BA',
    description: 'Cultura, história e muito axé pelas ladeiras de Salvador.',
    photos: ['https://placehold.co/600x400?text=Pelourinho'],
  },
];

const useRemote = () => isSupabaseConfigured && supabase;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function rowToTrip(row) {
  const norm = normalizeState(row.state_uf || row.state);
  return {
    id: String(row.id),
    title: row.title,
    date: row.date,
    state: norm.name,
    stateUf: norm.uf,
    description: row.description,
    photos: Array.isArray(row.photos) ? row.photos : [],
  };
}

/**
 * Upload de fotos. Com Supabase configurado, erros são PROPAGADOS
 * (nada de gravar base64 gigante no banco). Em modo demo usa base64 local.
 */
export async function uploadPhotos(userId, files) {
  if (!files || files.length === 0) return [];
  const urls = [];

  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue;

    if (useRemote()) {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

      const { error } = await supabase.storage
        .from('trips')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) throw new Error(`Falha no upload da foto: ${error.message}`);

      const { data } = supabase.storage.from('trips').getPublicUrl(path);
      urls.push(data.publicUrl);
    } else {
      urls.push(await fileToBase64(file));
    }
  }
  return urls;
}

export async function fetchUserTrips(userId) {
  if (!userId) return [];

  if (useRemote()) {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('[MapKeep] Erro ao buscar viagens:', error);
      throw new Error(error.message);
    }
    return (data || []).map(rowToTrip);
  }
  return getLocalTrips(userId);
}

export async function createTrip(userId, tripData, photoFiles = []) {
  const norm = normalizeState(tripData.state || tripData.stateUf);
  const uploaded = await uploadPhotos(userId, photoFiles);
  const photos = [...(Array.isArray(tripData.photos) ? tripData.photos : []), ...uploaded];

  if (useRemote()) {
    const { data, error } = await supabase
      .from('trips')
      .insert([{
        user_id: userId,
        title: tripData.title,
        date: tripData.date,
        state: norm.name,
        state_uf: norm.uf,
        description: tripData.description,
        photos,
      }])
      .select()
      .single();

    if (error) {
      console.error('[MapKeep] Erro ao criar viagem:', error);
      throw new Error(error.message);
    }
    return rowToTrip(data);
  }

  return saveLocalTrip(userId, {
    title: tripData.title,
    date: tripData.date,
    state: norm.name,
    stateUf: norm.uf,
    description: tripData.description,
    photos,
  });
}

export async function updateTrip(tripId, userId, tripData, newPhotoFiles = []) {
  const norm = normalizeState(tripData.state || tripData.stateUf);
  const uploaded = await uploadPhotos(userId, newPhotoFiles);
  const photos = [...(Array.isArray(tripData.photos) ? tripData.photos : []), ...uploaded];

  if (useRemote()) {
    const { data, error } = await supabase
      .from('trips')
      .update({
        title: tripData.title,
        date: tripData.date,
        state: norm.name,
        state_uf: norm.uf,
        description: tripData.description,
        photos,
      })
      .eq('id', tripId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[MapKeep] Erro ao atualizar viagem:', error);
      throw new Error(error.message);
    }
    return rowToTrip(data);
  }

  return updateLocalTrip(userId, tripId, {
    title: tripData.title,
    date: tripData.date,
    state: norm.name,
    stateUf: norm.uf,
    description: tripData.description,
    photos,
  });
}

export async function deleteTrip(tripId, userId) {
  if (useRemote()) {
    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('id', tripId)
      .eq('user_id', userId);

    if (error) {
      console.error('[MapKeep] Erro ao excluir viagem:', error);
      throw new Error(error.message);
    }
    return;
  }
  deleteLocalTrip(userId, tripId);
}

// ---------- Persistência local (somente modo demo) ----------
function getLocalTrips(userId) {
  const key = LOCAL_STORAGE_TRIPS_PREFIX + userId;
  const raw = localStorage.getItem(key);
  if (!raw) {
    localStorage.setItem(key, JSON.stringify(DEFAULT_DEMO_TRIPS));
    return [...DEFAULT_DEMO_TRIPS];
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalTrip(userId, payload) {
  const trips = getLocalTrips(userId);
  const newTrip = { id: 't_' + Date.now(), ...payload };
  trips.push(newTrip);
  localStorage.setItem(LOCAL_STORAGE_TRIPS_PREFIX + userId, JSON.stringify(trips));
  return newTrip;
}

function updateLocalTrip(userId, tripId, payload) {
  const trips = getLocalTrips(userId);
  const index = trips.findIndex((t) => t.id === tripId);
  if (index === -1) return null;
  trips[index] = { ...trips[index], ...payload };
  localStorage.setItem(LOCAL_STORAGE_TRIPS_PREFIX + userId, JSON.stringify(trips));
  return trips[index];
}

function deleteLocalTrip(userId, tripId) {
  const trips = getLocalTrips(userId).filter((t) => t.id !== tripId);
  localStorage.setItem(LOCAL_STORAGE_TRIPS_PREFIX + userId, JSON.stringify(trips));
}

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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Upload de fotos para o bucket "trips" no Supabase Storage (com fallback Base64 se demo/offline)
 */
export async function uploadPhotos(userId, files) {
  if (!files || files.length === 0) return [];
  const urls = [];

  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue;

    if (isSupabaseConfigured && supabase && userId) {
      try {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('trips')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('trips')
          .getPublicUrl(fileName);

        urls.push(publicUrlData.publicUrl);
      } catch (err) {
        console.warn('[MapKeep] Falha no upload para Supabase Storage, usando fallback Base64:', err);
        const base64 = await fileToBase64(file);
        urls.push(base64);
      }
    } else {
      const base64 = await fileToBase64(file);
      urls.push(base64);
    }
  }

  return urls;
}

/**
 * Busca todas as viagens do usuário autenticado no Supabase
 */
export async function fetchUserTrips(userId) {
  if (!userId) return [];

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) throw error;

      return (data || []).map((row) => {
        const norm = normalizeState(row.state || row.state_uf);
        return {
          id: String(row.id),
          title: row.title,
          date: row.date,
          state: norm.name,
          stateUf: norm.uf,
          description: row.description,
          photos: Array.isArray(row.photos) ? row.photos : [],
        };
      });
    } catch (err) {
      console.error('[MapKeep] Erro ao buscar viagens no Supabase:', err);
      return getLocalTrips(userId);
    }
  } else {
    return getLocalTrips(userId);
  }
}

/**
 * Cria uma nova viagem
 */
export async function createTrip(userId, tripData, photoFiles = []) {
  const norm = normalizeState(tripData.state || tripData.stateUf);
  const uploadedUrls = await uploadPhotos(userId, photoFiles);
  const existingPhotos = Array.isArray(tripData.photos) ? tripData.photos : [];
  const finalPhotos = [...existingPhotos, ...uploadedUrls];

  const payload = {
    user_id: userId,
    title: tripData.title,
    date: tripData.date,
    state: norm.name,
    state_uf: norm.uf,
    description: tripData.description,
    photos: finalPhotos,
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('trips')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      return {
        id: String(data.id),
        title: data.title,
        date: data.date,
        state: norm.name,
        stateUf: norm.uf,
        description: data.description,
        photos: data.photos || [],
      };
    } catch (err) {
      console.error('[MapKeep] Erro ao criar viagem no Supabase:', err);
      return saveLocalTrip(userId, {
        title: tripData.title,
        date: tripData.date,
        state: norm.name,
        stateUf: norm.uf,
        description: tripData.description,
        photos: finalPhotos,
      });
    }
  } else {
    return saveLocalTrip(userId, {
      title: tripData.title,
      date: tripData.date,
      state: norm.name,
      stateUf: norm.uf,
      description: tripData.description,
      photos: finalPhotos,
    });
  }
}

/**
 * Atualiza uma viagem existente
 */
export async function updateTrip(tripId, userId, tripData, newPhotoFiles = []) {
  const norm = normalizeState(tripData.state || tripData.stateUf);
  const uploadedUrls = await uploadPhotos(userId, newPhotoFiles);
  const existingPhotos = Array.isArray(tripData.photos) ? tripData.photos : [];
  const finalPhotos = [...existingPhotos, ...uploadedUrls];

  const payload = {
    title: tripData.title,
    date: tripData.date,
    state: norm.name,
    state_uf: norm.uf,
    description: tripData.description,
    photos: finalPhotos,
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('trips')
        .update(payload)
        .eq('id', tripId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      return {
        id: String(data.id),
        title: data.title,
        date: data.date,
        state: norm.name,
        stateUf: norm.uf,
        description: data.description,
        photos: data.photos || [],
      };
    } catch (err) {
      console.error('[MapKeep] Erro ao atualizar no Supabase:', err);
      return updateLocalTrip(userId, tripId, {
        title: tripData.title,
        date: tripData.date,
        state: norm.name,
        stateUf: norm.uf,
        description: tripData.description,
        photos: finalPhotos,
      });
    }
  } else {
    return updateLocalTrip(userId, tripId, {
      title: tripData.title,
      date: tripData.date,
      state: norm.name,
      stateUf: norm.uf,
      description: tripData.description,
      photos: finalPhotos,
    });
  }
}

/**
 * Exclui uma viagem
 */
export async function deleteTrip(tripId, userId) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('trips')
        .delete()
        .eq('id', tripId)
        .eq('user_id', userId);

      if (error) throw error;
    } catch (err) {
      console.error('[MapKeep] Erro ao excluir no Supabase:', err);
    }
  }
  deleteLocalTrip(userId, tripId);
}

// Helpers de persistência local (fallback / demo)
function getLocalTrips(userId) {
  const key = LOCAL_STORAGE_TRIPS_PREFIX + userId;
  const raw = localStorage.getItem(key);
  if (!raw) {
    localStorage.setItem(key, JSON.stringify(DEFAULT_DEMO_TRIPS));
    return DEFAULT_DEMO_TRIPS;
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
  if (index !== -1) {
    trips[index] = { ...trips[index], ...payload };
    localStorage.setItem(LOCAL_STORAGE_TRIPS_PREFIX + userId, JSON.stringify(trips));
    return trips[index];
  }
  return null;
}

function deleteLocalTrip(userId, tripId) {
  const trips = getLocalTrips(userId);
  const filtered = trips.filter((t) => t.id !== tripId);
  localStorage.setItem(LOCAL_STORAGE_TRIPS_PREFIX + userId, JSON.stringify(filtered));
}

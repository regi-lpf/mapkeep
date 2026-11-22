import { db, storage, isFirebaseConfigured } from './firebase-config.js';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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

/**
 * Converte um arquivo de imagem para Base64 Data URL (para uso local/fallback)
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Faz upload de fotos para o Firebase Storage ou converte para Base64 se não configurado
 */
export async function uploadPhotos(userId, files) {
  if (!files || files.length === 0) return [];
  const urls = [];

  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue;

    if (isFirebaseConfigured && storage && userId) {
      try {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        const storageRef = ref(storage, `trips/${userId}/${fileName}`);
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);
        urls.push(downloadUrl);
      } catch (err) {
        console.warn('[MapKeep] Falha no upload para Storage, usando fallback Base64:', err);
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
 * Retorna as viagens do usuário autenticado
 */
export async function fetchUserTrips(userId) {
  if (!userId) return [];

  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, 'trips'),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const trips = snapshot.docs.map((d) => {
        const data = d.data();
        const norm = normalizeState(data.state || data.stateUf);
        return {
          id: d.id,
          ...data,
          state: norm.name,
          stateUf: norm.uf,
        };
      });
      // Ordenação client-side por data decrescente
      return trips.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch (err) {
      console.error('[MapKeep] Erro ao buscar viagens no Firestore:', err);
      // Fallback para localStorage
      return getLocalTrips(userId);
    }
  } else {
    return getLocalTrips(userId);
  }
}

/**
 * Adiciona uma nova viagem
 */
export async function createTrip(userId, tripData, photoFiles = []) {
  const norm = normalizeState(tripData.state || tripData.stateUf);
  const uploadedUrls = await uploadPhotos(userId, photoFiles);
  const existingPhotos = Array.isArray(tripData.photos) ? tripData.photos : [];
  const finalPhotos = [...existingPhotos, ...uploadedUrls];

  const payload = {
    userId,
    title: tripData.title,
    date: tripData.date,
    state: norm.name,
    stateUf: norm.uf,
    description: tripData.description,
    photos: finalPhotos,
  };

  if (isFirebaseConfigured && db) {
    try {
      const docRef = await addDoc(collection(db, 'trips'), {
        ...payload,
        createdAt: serverTimestamp(),
      });
      return { id: docRef.id, ...payload };
    } catch (err) {
      console.error('[MapKeep] Erro ao criar viagem no Firestore:', err);
      return saveLocalTrip(userId, payload);
    }
  } else {
    return saveLocalTrip(userId, payload);
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
    stateUf: norm.uf,
    description: tripData.description,
    photos: finalPhotos,
  };

  if (isFirebaseConfigured && db) {
    try {
      const tripRef = doc(db, 'trips', tripId);
      await updateDoc(tripRef, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      return { id: tripId, userId, ...payload };
    } catch (err) {
      console.error('[MapKeep] Erro ao atualizar no Firestore:', err);
      return updateLocalTrip(userId, tripId, payload);
    }
  } else {
    return updateLocalTrip(userId, tripId, payload);
  }
}

/**
 * Exclui uma viagem
 */
export async function deleteTrip(tripId, userId) {
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'trips', tripId));
    } catch (err) {
      console.error('[MapKeep] Erro ao excluir no Firestore:', err);
    }
  }
  deleteLocalTrip(userId, tripId);
}

// Helpers de persistência local (fallback / demo)
function getLocalTrips(userId) {
  const key = LOCAL_STORAGE_TRIPS_PREFIX + userId;
  const raw = localStorage.getItem(key);
  if (!raw) {
    // Inicializa com dados demo padronizados
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

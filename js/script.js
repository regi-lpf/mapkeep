import {
  signInWithGoogle,
  observeAuthState,
  updateHeaderUserUI,
} from './auth.js';
import {
  fetchUserTrips,
  createTrip,
  updateTrip,
  deleteTrip,
} from './trips-service.js';
import {
  BRAZIL_STATES,
  getStateNameByUf,
  getStateUfByNameOrUf,
  populateStateSelect,
  normalizeState,
} from './states.js';

let currentUser = null;
let myTrips = [];
let currentOpenModalId = null;
let currentMapSelectedUf = null;
let pendingPhotoFiles = [];

// ==========================================
// Modal Helpers
// ==========================================
function showModal(modalId) {
  const modalElement = document.getElementById(modalId);
  if (modalElement) {
    modalElement.classList.remove('hidden');
    currentOpenModalId = modalId;
    document.body.style.overflow = 'hidden';
  }
}

function hideModal() {
  if (currentOpenModalId) {
    const modalElement = document.getElementById(currentOpenModalId);
    if (modalElement) modalElement.classList.add('hidden');
    currentOpenModalId = null;
    document.body.style.overflow = '';
  }
}

// ==========================================
// Lifecycle & Route Guard
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  const bodyId = document.body.id;

  // Listeners globais de fechamento de modal
  document.body.addEventListener('click', (event) => {
    if (event.target.classList.contains('close-modal-button')) {
      hideModal();
    }
    if (event.target.classList.contains('modal-backdrop')) {
      if (currentOpenModalId && event.target.id === currentOpenModalId) {
        hideModal();
      }
    }
  });

  if (bodyId === 'login-page-body') {
    initLoginPage();
    return;
  }

  // Páginas protegidas (trips / map)
  observeAuthState(async (user) => {
    if (!user) {
      window.location.replace('login.html');
      return;
    }
    currentUser = user;
    updateHeaderUserUI(user);

    // Carrega as viagens do usuário
    try {
      myTrips = await fetchUserTrips(user.uid);
    } catch (err) {
      myTrips = [];
      showLoadError(err);
    }

    if (bodyId === 'timeline-page-body') {
      initTimelinePage();
    } else if (bodyId === 'map-page-body') {
      initMapPage();
    }
  });
});


function showLoadError(err) {
  console.error('[MapKeep] Falha ao carregar viagens:', err);
  const target =
    document.getElementById('trip-list-container') ||
    document.getElementById('map-stats');
  if (target) {
    target.innerHTML = '<p class="login-feedback">Não foi possível carregar suas viagens: ' +
      (err && err.message ? err.message : 'erro desconhecido') + '</p>';
  }
}
// ==========================================
// Login Page
// ==========================================
function initLoginPage() {
  observeAuthState((user) => {
    if (user) {
      window.location.replace('trips.html');
    }
  });

  const loginBtn = document.getElementById('login-button');
  const feedbackEl = document.getElementById('login-feedback');

  if (loginBtn) {
    loginBtn.onclick = async () => {
      loginBtn.disabled = true;
      loginBtn.innerHTML = 'Conectando ao Google...';
      if (feedbackEl) feedbackEl.textContent = '';

      try {
        const result = await signInWithGoogle();
        // Com Supabase o navegador já está sendo redirecionado ao Google: não navegar aqui.
        if (!result.redirecting) window.location.replace('trips.html');
      } catch (err) {
        console.error(err);
        loginBtn.disabled = false;
        loginBtn.innerHTML = `Entrar com Google <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google Logo">`;
        if (feedbackEl) {
          feedbackEl.textContent =
            err.code === 'auth/popup-closed-by-user'
              ? 'Login cancelado.'
              : 'Não foi possível autenticar. Verifique sua conexão ou configuração.';
        }
      }
    };
  }
}

// ==========================================
// Timeline Page (trips.html)
// ==========================================
function initTimelinePage() {
  setActiveNavLink('trips.html');
  renderTripListForTimeline();

  const fabTimeline = document.getElementById('add-trip-fab');
  const addTripModalOnTimeline = document.getElementById('add-trip-modal');

  if (fabTimeline && addTripModalOnTimeline) {
    fabTimeline.onclick = () => {
      setupAndShowAddEditModal(addTripModalOnTimeline.id, null, null, async () => {
        renderTripListForTimeline();
      });
    };
  }

  setupDetailModalActions(() => {
    renderTripListForTimeline();
  });
}

function renderTripListForTimeline() {
  const container = document.getElementById('trip-list-container');
  if (!container) return;

  if (myTrips.length === 0) {
    container.innerHTML = `<p class="no-trips-message">Nenhuma viagem registrada ainda. Clique no botão "+" para adicionar sua primeira aventura!</p>`;
    return;
  }

  const sortedTrips = [...myTrips].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  container.innerHTML = sortedTrips.map(createTripCardHTML).join('');

  container.querySelectorAll('.trip-card').forEach((card) => {
    card.onclick = () => showTripDetailModal(card.dataset.id);
  });
}

function createTripCardHTML(trip) {
  const photos = Array.isArray(trip.photos) ? trip.photos : [];
  const firstPhoto = photos.length > 0 ? photos[0] : 'https://placehold.co/120x120?text=Viagem';
  const displayDate = trip.date
    ? new Date(trip.date + 'T00:00:00').toLocaleDateString('pt-BR')
    : 'Data não informada';

  return `
    <div class="trip-card" data-id="${trip.id}">
      <img src="${firstPhoto}" class="trip-photo-thumbnail" alt="${trip.title}">
      <div class="trip-card-content">
        <h3>${trip.title}</h3>
        <p class="trip-date">${displayDate} &bull; ${trip.state} (${trip.stateUf || ''})</p>
      </div>
    </div>`;
}

function showTripDetailModal(tripId) {
  const trip = myTrips.find((t) => t.id === tripId);
  const detailModal = document.getElementById('trip-detail-modal');
  if (!trip || !detailModal) return;

  const displayDate = trip.date
    ? new Date(trip.date + 'T00:00:00').toLocaleDateString('pt-BR')
    : '';

  detailModal.querySelector('#detail-modal-title').textContent = trip.title;
  detailModal.querySelector('#trip-detail-image-modal').src =
    trip.photos && trip.photos.length > 0 ? trip.photos[0] : 'https://placehold.co/600x400?text=Viagem';
  detailModal.querySelector('#detail-modal-trip-title').textContent = `${trip.title} - ${trip.state} (${trip.stateUf || ''})`;
  detailModal.querySelector('#trip-detail-date-modal').textContent = displayDate ? `Data: ${displayDate}` : '';
  detailModal.querySelector('#trip-detail-description-modal').textContent = trip.description || '';

  const photosContainer = detailModal.querySelector('#trip-detail-photos-container');
  if (photosContainer) {
    photosContainer.innerHTML = '';
    if (Array.isArray(trip.photos)) {
      trip.photos.forEach((pUrl) => {
        photosContainer.innerHTML += `<img src="${pUrl}" alt="Foto da viagem">`;
      });
    }
  }

  const editButton = detailModal.querySelector('#edit-trip-from-detail-button');
  const deleteButton = detailModal.querySelector('#delete-trip-button');
  if (editButton) editButton.dataset.tripId = trip.id;
  if (deleteButton) deleteButton.dataset.tripId = trip.id;

  showModal('trip-detail-modal');
}

function setupDetailModalActions(refreshCallback) {
  const detailModal = document.getElementById('trip-detail-modal');
  if (!detailModal) return;

  const editButton = detailModal.querySelector('#edit-trip-from-detail-button');
  const deleteButton = detailModal.querySelector('#delete-trip-button');

  if (editButton) {
    editButton.onclick = function () {
      const tripId = this.dataset.tripId;
      const tripToEdit = myTrips.find((t) => t.id === tripId);
      if (tripToEdit) {
        hideModal();
        const addModalId = document.getElementById('add-trip-modal')
          ? 'add-trip-modal'
          : 'map-action-modal';
        setupAndShowAddEditModal(addModalId, tripToEdit, null, refreshCallback, addModalId === 'map-action-modal');
      }
    };
  }

  if (deleteButton) {
    deleteButton.onclick = async function () {
      const tripId = this.dataset.tripId;
      if (!tripId) return;

      if (confirm('Tem certeza de que deseja excluir este registro de viagem?')) {
        deleteButton.disabled = true;
        deleteButton.textContent = 'Excluindo...';
        try {
          await deleteTrip(tripId, currentUser.uid);
          myTrips = myTrips.filter((t) => t.id !== tripId);
          hideModal();
          if (typeof refreshCallback === 'function') refreshCallback();
        } catch (err) {
          alert('Erro ao excluir viagem.');
          console.error(err);
        } finally {
          deleteButton.disabled = false;
          deleteButton.textContent = 'Excluir';
        }
      }
    };
  }
}

// ==========================================
// Map Page (main.html)
// ==========================================
function initMapPage() {
  setActiveNavLink('main.html');
  updateMapVisitedHighlights();

  const svgMapElement = document.getElementById('brazil-map-actual-svg');
  let previouslySelectedStatePath = null;

  if (svgMapElement) {
    svgMapElement.querySelectorAll('.map-state').forEach((path) => {
      path.onclick = function () {
        const stateUf = (this.id || '').toUpperCase();
        if (!stateUf) return;

        currentMapSelectedUf = stateUf;

        if (previouslySelectedStatePath) {
          previouslySelectedStatePath.classList.remove('selected-map-state');
        }
        this.classList.add('selected-map-state');
        previouslySelectedStatePath = this;

        renderGalleryContentInMapPageModal(stateUf);
      };
    });
  }

  setupDetailModalActions(() => {
    updateMapVisitedHighlights();
    if (currentMapSelectedUf) {
      renderGalleryContentInMapPageModal(currentMapSelectedUf);
    }
  });
}

function updateMapVisitedHighlights() {
  const visitedUfs = new Set(
    myTrips.map((t) => (t.stateUf || getStateUfByNameOrUf(t.state)).toUpperCase())
  );

  const svgMapElement = document.getElementById('brazil-map-actual-svg');
  if (svgMapElement) {
    svgMapElement.querySelectorAll('.map-state').forEach((path) => {
      const uf = (path.id || '').toUpperCase();
      if (visitedUfs.has(uf)) {
        path.classList.add('visited-map-state');
      } else {
        path.classList.remove('visited-map-state');
      }
    });
  }

  const statsEl = document.getElementById('map-stats');
  if (statsEl) {
    const totalStates = 27;
    const visitedCount = visitedUfs.size;
    const percent = Math.round((visitedCount / totalStates) * 100);
    statsEl.innerHTML = `Você já explorou <strong>${visitedCount} de ${totalStates}</strong> estados (${percent}%)`;
  }
}

function renderGalleryContentInMapPageModal(stateUf) {
  const mapModalTitleEl = document.getElementById('map-modal-title');
  const mapModalBodyEl = document.getElementById('map-modal-body-content');
  const mapModalFooterEl = document.getElementById('map-modal-footer-content');

  const stateName = getStateNameByUf(stateUf);
  if (mapModalTitleEl) mapModalTitleEl.textContent = `Viagens em ${stateName} (${stateUf})`;

  const tripsForState = myTrips.filter((trip) => {
    const tUf = (trip.stateUf || getStateUfByNameOrUf(trip.state)).toUpperCase();
    return tUf === stateUf;
  });

  if (mapModalBodyEl) {
    mapModalBodyEl.innerHTML =
      tripsForState.length > 0
        ? tripsForState.map(createTripCardHTML).join('')
        : `<p style="padding: 15px 0;">Você ainda não registrou viagens para <strong>${stateName}</strong>.</p>`;

    // Correção do clique no card da página do mapa (abre diretamente o modal de detalhes)
    mapModalBodyEl.querySelectorAll('.trip-card').forEach((card) => {
      card.onclick = () => {
        showTripDetailModal(card.dataset.id);
      };
    });
  }

  if (mapModalFooterEl) {
    mapModalFooterEl.innerHTML = `
      <button id="map-modal-add-btn" class="button-link" style="background-color: var(--color-accent-primary); font-weight: bold;">
        + Adicionar Viagem em ${stateUf}
      </button>
    `;
    const addBtn = document.getElementById('map-modal-add-btn');
    if (addBtn) {
      addBtn.onclick = () => {
        setupAndShowAddEditModal(
          'map-action-modal',
          null,
          stateUf,
          async () => {
            updateMapVisitedHighlights();
            renderGalleryContentInMapPageModal(stateUf);
          },
          true
        );
      };
    }
  }

  showModal('map-action-modal');
}

// ==========================================
// Setup Add / Edit Modal
// ==========================================
function setupAndShowAddEditModal(
  modalId,
  tripToEdit = null,
  defaultStateUf = null,
  submitRefreshCallback,
  isMapPageDynamicModal = false
) {
  const modalElement = document.getElementById(modalId);
  if (!modalElement) return;

  pendingPhotoFiles = [];

  const titleValue = tripToEdit ? tripToEdit.title : '';
  const dateValue = tripToEdit ? tripToEdit.date : '';
  const stateSelected = defaultStateUf || (tripToEdit ? tripToEdit.stateUf || tripToEdit.state : '');
  const descriptionValue = tripToEdit ? tripToEdit.description : '';
  const tripIdValue = tripToEdit ? tripToEdit.id : '';

  let modalTitleText = tripToEdit ? 'Editar Viagem' : 'Adicionar Nova Viagem';
  if (isMapPageDynamicModal && defaultStateUf && !tripToEdit) {
    modalTitleText = `Adicionar Viagem em ${getStateNameByUf(defaultStateUf)} (${defaultStateUf})`;
  }

  if (isMapPageDynamicModal) {
    document.getElementById('map-modal-title').textContent = modalTitleText;
    const formHtmlContent = `
      <form id="dynamic-trip-form">
        <input type="hidden" id="trip-id-input" value="${tripIdValue}">
        <div><label for="trip-title-input">Cidade/Local:</label><input type="text" id="trip-title-input" value="${titleValue}" placeholder="Ex: Gramado" required></div>
        <div><label for="trip-date-input">Data:</label><input type="date" id="trip-date-input" value="${dateValue}" required></div>
        <div><label for="trip-state-form-input">Estado:</label><select id="trip-state-form-input" required></select></div>
        <div><label for="trip-description-input">Memórias:</label><textarea id="trip-description-input" rows="3" placeholder="O que marcou essa viagem?" required>${descriptionValue}</textarea></div>
        <div>
          <label for="trip-photos-input">Fotos:</label>
          <input type="file" id="trip-photos-input" accept="image/*" multiple>
          <div class="photo-preview-container"></div>
        </div>
        <button type="submit" id="save-trip-btn">Salvar Viagem</button>
      </form>`;
    document.getElementById('map-modal-body-content').innerHTML = formHtmlContent;
    document.getElementById('map-modal-footer-content').innerHTML = '';

    const selectEl = document.getElementById('trip-state-form-input');
    populateStateSelect(selectEl, stateSelected);

    const form = document.getElementById('dynamic-trip-form');
    bindFormSubmitAndPhotos(form, tripToEdit, submitRefreshCallback);
  } else {
    const staticModalTitle = modalElement.querySelector('#add-trip-modal-title');
    const form = modalElement.querySelector('#trip-form');
    if (!form || !staticModalTitle) return;

    staticModalTitle.textContent = modalTitleText;
    form.reset();
    form.querySelector('#trip-id-input').value = tripIdValue;
    form.querySelector('#trip-title-input').value = titleValue;
    form.querySelector('#trip-date-input').value = dateValue;
    form.querySelector('#trip-description-input').value = descriptionValue;

    const selectEl = form.querySelector('#trip-state-form-input');
    populateStateSelect(selectEl, stateSelected);

    const photoPreview = form.querySelector('.photo-preview-container');
    if (photoPreview) {
      photoPreview.innerHTML = '';
      if (tripToEdit && Array.isArray(tripToEdit.photos)) {
        tripToEdit.photos.forEach((pUrl) => {
          photoPreview.innerHTML += `<img src="${pUrl}" alt="Preview">`;
        });
      }
    }

    bindFormSubmitAndPhotos(form, tripToEdit, submitRefreshCallback);
  }

  showModal(modalId);
}

function bindFormSubmitAndPhotos(form, tripToEdit, refreshCallback) {
  const photoInput = form.querySelector('#trip-photos-input');
  if (photoInput) {
    photoInput.onchange = (e) => {
      pendingPhotoFiles = Array.from(e.target.files || []);
      const previewContainer = form.querySelector('.photo-preview-container');
      if (!previewContainer) return;
      previewContainer.innerHTML = '';

      // Mostra fotos já existentes se estiver editando
      if (tripToEdit && Array.isArray(tripToEdit.photos)) {
        tripToEdit.photos.forEach((pUrl) => {
          previewContainer.innerHTML += `<img src="${pUrl}" alt="Foto existente">`;
        });
      }

      // Preview das novas fotos selecionadas via FileReader seguro
      pendingPhotoFiles.forEach((file) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (re) => {
            const img = document.createElement('img');
            img.src = re.target.result;
            previewContainer.appendChild(img);
          };
          reader.readAsDataURL(file);
        }
      });
    };
  }

  form.onsubmit = async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector('#save-trip-btn') || form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Salvando...';
    }

    const tripId = form.querySelector('#trip-id-input').value;
    const title = form.querySelector('#trip-title-input').value;
    const date = form.querySelector('#trip-date-input').value;
    const stateVal = form.querySelector('#trip-state-form-input').value;
    const description = form.querySelector('#trip-description-input').value;

    const norm = normalizeState(stateVal);

    try {
      if (tripId) {
        // Atualização
        const existingTrip = myTrips.find((t) => t.id === tripId);
        const updated = await updateTrip(
          tripId,
          currentUser.uid,
          {
            title,
            date,
            state: norm.name,
            stateUf: norm.uf,
            description,
            photos: existingTrip ? existingTrip.photos : [],
          },
          pendingPhotoFiles
        );
        const idx = myTrips.findIndex((t) => t.id === tripId);
        if (idx !== -1) myTrips[idx] = updated;
      } else {
        // Criação
        const created = await createTrip(
          currentUser.uid,
          {
            title,
            date,
            state: norm.name,
            stateUf: norm.uf,
            description,
            photos: [],
          },
          pendingPhotoFiles
        );
        myTrips.push(created);
      }

      hideModal();
      if (typeof refreshCallback === 'function') {
        await refreshCallback();
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar a viagem. Tente novamente.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salvar';
      }
    }
  };
}

// ==========================================
// Navigation Active Class
// ==========================================
function setActiveNavLink(pageName) {
  const links = document.querySelectorAll('#main-header nav a, #main-nav a');
  links.forEach((a) => {
    const href = a.getAttribute('href');
    if (href === pageName) {
      a.classList.add('active-nav');
    } else {
      a.classList.remove('active-nav');
    }
  });
}

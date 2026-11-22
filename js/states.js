/**
 * Tabela e utilitários para os 26 estados brasileiros + Distrito Federal.
 */
export const BRAZIL_STATES = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
];

const UF_TO_NAME = new Map(BRAZIL_STATES.map(s => [s.uf, s.name]));
const NAME_TO_UF = new Map(BRAZIL_STATES.map(s => [s.name.toLowerCase(), s.uf]));

export function getStateNameByUf(uf) {
  if (!uf) return '';
  return UF_TO_NAME.get(uf.toUpperCase()) || uf;
}

export function getStateUfByNameOrUf(input) {
  if (!input) return '';
  const clean = input.trim();
  if (clean.length === 2 && UF_TO_NAME.has(clean.toUpperCase())) {
    return clean.toUpperCase();
  }
  return NAME_TO_UF.get(clean.toLowerCase()) || clean.toUpperCase();
}

export function normalizeState(input) {
  const uf = getStateUfByNameOrUf(input);
  const name = getStateNameByUf(uf) || input;
  return { uf, name };
}

/**
 * Preenche um elemento <select> com os estados brasileiros
 */
export function populateStateSelect(selectEl, selectedValue = '') {
  if (!selectEl) return;
  const currentUf = getStateUfByNameOrUf(selectedValue);
  
  selectEl.innerHTML = '<option value="">Selecione o estado...</option>' +
    BRAZIL_STATES.map(s => 
      `<option value="${s.uf}" ${s.uf === currentUf ? 'selected' : ''}>${s.name} (${s.uf})</option>`
    ).join('');
}

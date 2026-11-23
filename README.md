# MapKeep 🗺️✈️

O **MapKeep** é uma aplicação web desenvolvida para registrar e reviver experiências de viagem pelos estados do Brasil.

A aplicação conta com um mapa interativo onde os estados visitados ganham destaque visual com contador de exploração pelo país, além de uma linha do tempo cronológica com memórias, fotos e datas.

---

## 🛠️ Stack Tecnológica

- **Front-end:** HTML5 semântico, CSS3 (design neo-brutalista), Vanilla JavaScript (ES Modules).
- **Tooling & Build:** [Vite](https://vitejs.dev/) para empacotamento, live reload e injeção de variáveis de ambiente.
- **Backend-as-a-Service (Supabase):**
  - **Supabase Auth:** Autenticação com Google OAuth2.
  - **PostgreSQL / PostgREST:** Banco de dados relacional com Row Level Security (RLS).
  - **Supabase Storage:** Armazenamento e CDN de fotos de viagens.
- **CI/CD:** GitHub Actions para build e deploy automatizado no GitHub Pages.

---

## 🚀 Como Executar

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior)

### 1. Clonar e Instalar Dependências
```bash
git clone https://github.com/regi-lpf/mapkeep.git
cd mapkeep
npm install
```

### 2. Configuração de Variáveis de Ambiente (Opcional)
Copie o template de exemplo e insira suas credenciais do Firebase:
```bash
cp .env.example .env
```

> **Dica:** Caso não configure o `.env`, o MapKeep inicia automaticamente em **modo de demonstração local** (com persistência no navegador), permitindo navegar e testar todas as funcionalidades da interface sem travar.

### 3. Rodar Localmente
```bash
npm run dev
```

### 4. Compilar para Produção
```bash
npm run build
```
Os arquivos otimizados serão gerados na pasta `dist/`.

---

## 👥 Autores

* **Reginaldo Filho** — [GitHub](https://github.com/regi-lpf)
* **Ricardo Alves** — [GitHub](https://github.com/RicardoNatiruts)

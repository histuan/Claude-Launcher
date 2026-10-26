# Estado

**Fase atual:** 2 — Tela (não iniciada). Fase 1 concluída em 26/10/2026.

## Feito

- Planejamento completo (`docs/ESCOPO.md`, `docs/WINDOWS.md`, `docs/FASES.md`).
- Fase 0 no PC do Thiago (26/10/2026): perfil isolado com `--user-data-dir` funciona no Claude 3.6556.2.0.
- Fase 1 (26/10/2026): `package.json` (Electron 44, electron-builder 26, NSIS por usuário), estrutura `src/`, janela com texto
  provisório, `src/core/greeting.js` + teste, workflow `.github/workflows/claude-multiconta.yml` (testes no Ubuntu, `.exe` no Windows,
  Release em tag `multiconta-v*`).

## Falta

- Fases 2 a 6 (`docs/FASES.md`).
- Ícone ainda é o padrão do Electron (ícone original fica para a fase de acabamento).

## Decisões

- Electron + JS puro; `.exe` só pelo GitHub Actions.
- Login de contas extras por snapshot do perfil padrão, com stash e restauração.
- E-mail e nome automáticos com fallback manual; foto escolhida pela pessoa, inicial como padrão.
- Ícone original e fonte serifada livre (sem logo e sem fonte oficial do Claude).
- Tema escuro só na v1; launcher fecha sozinho ao abrir uma conta.

## Como testar

Fase 1:
1. GitHub → aba **Actions** → workflow **claude-multiconta** → última execução verde → baixar o artefato
   **multiconta-instalador** (zip) e extrair o `Multiconta-para-Claude-Setup-0.1.0.exe`.
2. Rodar o instalador. O SmartScreen deve reclamar (exe não assinado): "Mais informações → Executar assim mesmo".
   Conferir que **não pede administrador** (instalação por usuário).
3. Abrir "Multiconta para Claude" pelo **Menu Iniciar**: janela escura com o título e o texto
   "Esqueleto da Fase 1…". Fechar a janela encerra o app.
4. Desinstalar por Configurações → Aplicativos (opcional), para conferir que sai limpo.

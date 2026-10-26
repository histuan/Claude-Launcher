# Multiconta para Claude — instruções para o Claude Code

Launcher para Windows (Electron) que abre o app desktop do Claude em perfis isolados
(`--user-data-dir`), uma conta por perfil, sem precisar deslogar e logar.

- Escopo do produto: `docs/ESCOPO.md`
- Fatos verificados do Windows e desenho do login: `docs/WINDOWS.md`
- Plano por fases (com o prompt de cada uma): `docs/FASES.md`
- Onde paramos: `ESTADO.md`

## Antes de qualquer coisa

1. Use a skill **dev-economico** (vem da conta do Thiago). Se ela não estiver disponível nesta sessão, diga isso no começo
   do relatório e trabalhe de forma econômica: ler só o necessário, escopo fechado, testar antes de dar por pronto.
2. Leia `ESTADO.md` e só a seção da fase atual em `docs/FASES.md`. Leia `ESCOPO.md` e `WINDOWS.md` só nas seções que a fase citar.
3. Trabalhe só em `claude-multiconta/` e em `.github/workflows/claude-multiconta.yml`. Este repositório é um monorepo:
   nunca leia nem altere as outras pastas (`lorax-space-invaders`, `web-development` etc.).

## Ambiente

- Normalmente você está numa **cloud session**: Linux, sem tela, sem acesso ao PC do Thiago.
- O `.exe` é gerado pelo **GitHub Actions** (`windows-latest`), nunca dentro da sessão. Não tente Wine nem Docker.
- Exceção ao dev-economico: aqui o `ESTADO.md` vai **no git**, porque a VM da nuvem é apagada.
- Commits: ao fim de cada fase, commit + push na `main` (já combinado). Mensagens de commit em inglês.
  Se o push na `main` for recusado pelo ambiente, faça push na branch que a sessão permitir, abra um PR para a `main`
  e diga isso no relatório (o workflow roda em qualquer branch, então o `.exe` sai mesmo assim).
  Se a `main` aceitar o push, não empurre também a branch da sessão (gera uma execução duplicada do workflow).
- Na nuvem não é preciso baixar o binário do Electron para testar a lógica: use `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`
  (só tire isso se for tentar o print offscreen).
- Para conferir o Actions, use `gh run list` / `gh run view` (API REST). Se o `gh` não funcionar, diga no relatório
  e o Thiago confere na aba Actions.
- Claude Code local (no PC do Thiago) é último recurso: só quando um bug só aparece no Windows real e os logs não bastam.

## Stack

- Electron + **TypeScript** (`strict`), compilado com `tsc`. Interface em HTML/CSS + TS, sem framework.
  (Migração de JS para TS feita na Fase 1.5.)
- Testes: `node:test` (sem dependência). Build: `electron-builder` (instalador NSIS).
- Fontes livres (OFL) embutidas via `@fontsource`. Nada de CDN: o app funciona offline.
- Dependência nova: justificar em uma linha no relatório.

## Comandos (dentro de `claude-multiconta/`)

- `npm ci` — instalar
- `npm test` — testes
- `npm start` — abre o app (não funciona na nuvem, que não tem tela)

## Arquitetura

- `src/core/` — lógica pura e testável (saudação, nome, regras de perfil, estado do login).
- `src/main/` — processo principal do Electron.
- `src/main/system/` — o **único** lugar que toca o Windows (PowerShell, processos, pastas do Claude).
  Tudo injetável, para os testes usarem mocks.
- `src/renderer/` — interface. `preload` com `contextBridge`, `contextIsolation: true`, `nodeIntegration: false`.
- Configuração do launcher: JSON em `app.getPath('userData')`.

## Regras que nunca podem ser quebradas

1. Nunca copiar, modificar ou mover o app do Claude (`WindowsApps`). Resolver o `Claude.exe` a cada abertura via `Get-AppxPackage`.
2. O perfil padrão do Claude só é tocado pelo fluxo de login (`docs/WINDOWS.md`, seção 4), com stash, marcador e restauração. Nenhum outro código escreve lá.
3. Cookies e tokens de sessão: nunca logar, nunca salvar em texto claro, nunca enviar para outro host além de `claude.ai`.
4. Detectar processos do Claude pelo **caminho** do exe (`\WindowsApps\Claude_*\app\Claude.exe`), nunca só pelo nome:
   o Claude Code CLI também se chama `claude.exe`. Ignorar processos com `--type=` (filhos do Chromium).
5. Caminhos sempre por variável de ambiente (`USERPROFILE`, `LOCALAPPDATA`), nunca `C:\Users\thiag`.
6. Não usar o logo nem a fonte oficial do Claude. Ícone original; fonte serifada livre.
7. Abrir o Claude com `spawn` detached, `stdio: 'ignore'`, `windowsHide: true`, e `unref()`.

## Verificação

- Lógica: testes `node:test` com mocks de `src/main/system/`.
- Interface: se der, um print via Electron offscreen (`xvfb-run`). Se não der na nuvem, diga e deixe para o Thiago.
- O teste real é no PC do Thiago: no fim da fase, escreva em `ESTADO.md` um "Como testar" curto (baixar o artefato do Actions, instalar, o que conferir).
- Se algo da fase for impossível na nuvem, pare e explique em vez de improvisar.

## Manias a evitar

- (vazio por enquanto; adicionar aqui o que o Thiago corrigir)

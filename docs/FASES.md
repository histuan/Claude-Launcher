# Plano por fases

Cada fase = **uma cloud session nova** (sessão nova não carrega histórico, é o "/clear" da nuvem).
Modelo: Opus 5.5, esforço `medium` (`high` só se travar).
Entre as fases, o Thiago baixa o `.exe` do Actions e testa no PC.

## Prompt para colar em cada fase

Troque `N` pelo número da fase:

```
Fase N do projeto claude-multiconta (repo histuan/projects).
1. Use a skill dev-economico (se não existir nesta sessão, siga claude-multiconta/docs/dev-economico.md).
2. Leia claude-multiconta/CLAUDE.md, claude-multiconta/ESTADO.md e a seção "Fase N" de claude-multiconta/docs/FASES.md.
   Leia ESCOPO.md e WINDOWS.md só nas seções que a fase citar.
3. Faça SÓ a Fase N. Ao terminar: verificação, atualize ESTADO.md (incluindo "Como testar") e o CHANGELOG,
   abra um Pull Request para a main seguindo a seção "Processo no GitHub" do CLAUDE.md,
   e o relatório final do dev-economico.
Se algo da fase for impossível na nuvem, pare e explique em vez de improvisar.
```

---

## Fase 0 — Testes no PC ✅ (26/10/2026)

Feita pelo Thiago, sem Claude. Resultado em `WINDOWS.md`, seção 1.

## Fase 1 — Esqueleto e build

Ler: `ESCOPO.md` §5.

- `package.json` (Electron, electron-builder; `appId` `com.histuan.multiconta`; `productName` "Multiconta para Claude"; NSIS por usuário).
- Estrutura `src/core`, `src/main`, `src/main/system`, `src/renderer`, `test/`. Janela abre com um texto provisório.
- `npm test` com `node:test` e 1 teste real de `src/core`.
- `.github/workflows/claude-multiconta.yml` **na raiz do repo**:
  - gatilhos: push em **qualquer branch** com `paths: claude-multiconta/**` e o próprio workflow (a sessão pode não
    conseguir dar push na `main`); `pull_request` com os mesmos paths; `workflow_dispatch`; tags `multiconta-v*`;
  - `defaults.run.working-directory: claude-multiconta`;
  - job de testes (ubuntu) e job de build (`windows-latest`): `npm ci`, `npm test`, `electron-builder --win --publish never`;
  - `upload-artifact` do instalador; em tag, criar Release com o instalador (`gh release create`).
- Pronto quando: o Actions fica verde (conferir com `gh run list` / `gh run view`) e o artefato existe.

## Fase 1.5 — Processo profissional no GitHub

Objetivo: deixar o projeto com cara de projeto profissional e **todo em inglês**.

0. **Renomear e traduzir (fazer primeiro):**
   - Nome do app: **Multi-Account Launcher for Claude**. Pasta: `git mv claude-multiconta claude-launcher`.
   - Workflow: `git mv` para `.github/workflows/claude-launcher.yml`; ajustar `paths`, `working-directory`, nome do
     artefato (`launcher-installer`) e tags `launcher-v*`.
   - `package.json`: `name` `claude-launcher`, `productName` "Multi-Account Launcher for Claude",
     `appId` `com.histuan.claude-launcher`, nome do instalador sem espaços.
   - **Traduzir para inglês** toda a documentação: `CLAUDE.md`, `ESTADO.md` → `STATUS.md`, `docs/ESCOPO.md` → `docs/SCOPE.md`,
     `docs/WINDOWS.md`, `docs/FASES.md` → `docs/PHASES.md` (incluindo o prompt-modelo, com os caminhos novos).
     Atualizar todas as referências cruzadas. Exceção: `docs/dev-economico.md` é cópia fiel da skill pessoal do Thiago e
     fica em português; só trocar o comentário do topo por uma linha em inglês explicando isso.
   - **Interface em inglês**, com todos os textos num único módulo (ex.: `src/renderer/strings.js`) para permitir outras
     línguas depois. Saudação: "Good morning" (5h–11h59), "Good afternoon" (12h–17h59), "Good evening" (18h–4h59);
     card "Main"; menu "Rename / Change photo / Remove"; botão "Add account"; indicador "● Running".
   - Atualizar a linha do projeto no `README.md` da raiz (nome e link novos).
   - Todos os itens abaixo já usam os nomes novos: escopo de commit `launcher`, tags `launcher-v*`, milestone
     "Multi-Account Launcher v1.0".

1. **Fluxo de PR:** reescrever no `CLAUDE.md` a parte de commits como uma seção "Processo no GitHub":
   - cada fase trabalha na branch da sessão e termina com um **Pull Request para a `main`** (nunca push direto na `main`);
   - commits no padrão *Conventional Commits* com escopo `launcher` (`feat(launcher): …`, `fix(…)`, `docs(…)`, `ci(…)`);
   - descrição do PR pelo modelo `.github/pull_request_template.md`, com `Closes #<issue da fase>`;
   - a fase sobe a versão em `package.json` para `0.N.0` (Fase 1.5 mantém `0.1.0`) e adiciona a seção no `CHANGELOG.md`;
   - o Thiago testa e faz o merge; a próxima fase só começa depois do merge.
2. **`.github/pull_request_template.md`** (raiz do repo, genérico para todos os projetos): Summary, Why, How it was tested,
   Screenshots, Checklist.
3. **`claude-multiconta/CHANGELOG.md`** no padrão *Keep a Changelog*, com a entrada `0.1.0` (Fase 1) e `Unreleased`.
4. **Release automática no merge:** no workflow, depois do build no `windows-latest`, quando o evento for push na `main`
   e a tag `launcher-v<versão do package.json>` ainda não existir: criar a tag e a Release com o instalador `.exe`,
   notas = seção daquela versão no `CHANGELOG.md`, marcada como *pre-release* enquanto a versão for `< 1.0.0`.
   Manter o `upload-artifact` (útil para testar PRs antes do merge).
5. **Atualizar as ações** do workflow para as versões atuais (checar no GitHub quais são; hoje dão aviso de Node 20).
6. **Issues:** criar o milestone "Multi-Account Launcher v1.0" e uma issue por fase (Fase 1 a 6, título e checklist curtos tirados
   deste arquivo), em inglês. Fechar a da Fase 1 citando o commit `b839fa5`. Esta fase fecha a própria issue no PR.
   Se o `gh` não tiver permissão para isso na nuvem, liste no relatório o que faltou.
7. **README** do projeto: badge do workflow, badge da última release, seção "Download" apontando para a página Releases,
   e link para o CHANGELOG.
8. Atualizar o "How to test" do `STATUS.md` para usar a página **Releases** em vez de Artifacts.

Pronto quando: o PR está aberto com o modelo preenchido, o Actions passa no PR, e após o merge aparece a Release
`launcher-v0.1.0` (pre-release) com o instalador.

## Fase 2 — Tela

Ler: `ESCOPO.md` §2, §3.

- Tela completa com dados falsos: saudação (regra de horário + nome do Windows + lápis só no nome), cards, card Principal,
  rolagem horizontal, botão adicionar, menu ⋯ (renomear e remover já funcionando no config; trocar foto pode ficar visual).
- Variáveis CSS do tema num só lugar. Fontes via `@fontsource`. Ícone original em SVG + `.ico` para o app e o instalador.
- Config do launcher (JSON em `userData`): `{ version, greetingName, accounts: [{ id, label, email, realName, photo, profileDir }] }`
  (`profileDir: null` = Principal).
- Testes: regra de horário, limpeza do nome (`"histuan ."` → `histuan`), leitura/escrita do config.
- Print offscreen se possível (uma imagem).

## Fase 3 — Abrir contas

Ler: `WINDOWS.md` §1, §2, §3.

- `system/claudeApp.js`: resolver o exe (MSIX, fallback antigo, erro claro se não houver).
- Abrir conta: Principal sem flag; outras com `--user-data-dir`. Launcher fecha sozinho depois.
- Indicador "● aberta": consulta de processos filtrada pelo caminho, a cada ~3 s com a janela visível.
- Temporário até a Fase 4: "Adicionar conta" só cria o card e a pasta do perfil (sem login).
- Testes com mocks do PowerShell (saídas JSON de exemplo, incluindo processos do Claude Code CLI que devem ser ignorados).

## Fase 4 — Login por snapshot

Ler: `WINDOWS.md` §4. Consultar `engine.py` do ai-multi-instance (só as funções do login).

- Fluxo completo da seção 4, com marcador, stash, restauração, cancelar e recuperação ao abrir.
- Testes com pastas temporárias reais: rodam no Linux **e** no job do `windows-latest`. Cobrir: sucesso, cancelar,
  "crash" no meio (marcador presente na abertura), processo padrão ainda vivo (abortar).
- "Como testar" no `ESTADO.md` com **backup manual antes** (copiar a pasta do perfil padrão para outro lugar).

## Fase 5 — Dados da conta e foto

Ler: `WINDOWS.md` §5, `ESCOPO.md` §2.2–2.3.

- Primeiro: script de diagnóstico (só chaves e caminhos, nunca valores de tokens) para o Thiago rodar e colar a saída.
  Parar a fase aqui se a saída ainda não existir.
- Depois: detecção na ordem da seção 5, com fallback manual. Atualizar também o card Principal.
- Trocar foto: escolher imagem, salvar uma cópia redimensionada em `userData/photos/<id>.png`; "voltar para a inicial".

## Fase 6 — Acabamento e release

- `README.md` em inglês (o que é, como instalar, SmartScreen, limitações, créditos, aviso de que não é afiliado à Anthropic).
- Revisar critérios de pronto (`ESCOPO.md` §7). Tag `multiconta-v1.0.0` → Release.
- Atualizar a linha do projeto no `README.md` da raiz do repo.

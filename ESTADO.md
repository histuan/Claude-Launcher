# Estado

**Fase atual:** 1 — Esqueleto e build (não iniciada)

## Feito

- Planejamento completo (`docs/ESCOPO.md`, `docs/WINDOWS.md`, `docs/FASES.md`).
- Fase 0 no PC do Thiago (26/10/2026): perfil isolado com `--user-data-dir` funciona no Claude 3.6556.2.0.

## Falta

- Fases 1 a 6 (`docs/FASES.md`).

## Decisões

- Electron + JS puro; `.exe` só pelo GitHub Actions.
- Login de contas extras por snapshot do perfil padrão, com stash e restauração.
- E-mail e nome automáticos com fallback manual; foto escolhida pela pessoa, inicial como padrão.
- Ícone original e fonte serifada livre (sem logo e sem fonte oficial do Claude).
- Tema escuro só na v1; launcher fecha sozinho ao abrir uma conta.

## Como testar

- (preencher no fim de cada fase)

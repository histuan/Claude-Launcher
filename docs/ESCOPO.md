# Escopo — Multiconta para Claude (v1, Windows)

## 1. O que é

Um app de uma tela só que **adiciona** e **abre** contas do Claude Desktop. Cada conta roda numa instância
separada do app oficial e fica sempre logada. Nada além disso.

## 2. A tela

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│        ✳  Boa noite, Thiago                          │  ← ícone original + saudação serifada
│                                                      │
│     ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│     │      ⋯   │  │      ⋯   │  │      ⋯   │         │  ← menu do card
│     │  ( T )   │  │  ( E )   │  │  (foto)  │         │  ← foto escolhida ou inicial
│     │          │  │          │  │          │         │
│     │ Principal│  │ Trabalho │  │ Faculdade│         │  ← nome que a pessoa deu
│     │ thiago@… │  │ eu@emp…  │  │ t@unifor…│         │  ← e-mail (cinza claro)
│     │ Thiago U.│  │ Thiago G.│  │ Thiago   │         │  ← nome real da conta (menor, mais cinza)
│     │ ● aberta │  │          │  │          │         │  ← só se a instância estiver rodando
│     └──────────┘  └──────────┘  └──────────┘  →      │  ← rola de lado só se não couber
│                                                      │
│               [ + Adicionar conta ]                  │
└──────────────────────────────────────────────────────┘
```

### 2.1 Saudação

- "Bom dia" das 5h00 às 11h59, "Boa tarde" das 12h00 às 17h59, "Boa noite" das 18h00 às 4h59 (hora local).
  Atualiza sozinha se o app ficar aberto na virada.
- Nome padrão: primeira palavra do **nome de exibição** do Windows (`Win32_UserAccount.FullName`), sem pontuação solta.
  Se vier vazio, usar `USERNAME`. Exemplo real da Fase 0: `FullName` = `"histuan ."` → `histuan`.
- **Edição:** ao passar o mouse **só sobre o nome** (não sobre "Boa noite,"), aparece um ✏️ logo depois dele.
  Clicar no nome ou no lápis transforma o nome em campo de texto. Enter salva, Esc cancela, campo vazio volta ao padrão.
  O nome editado fica salvo e passa a valer no lugar do nome do Windows.

### 2.2 Cards

- Retângulos em pé (~180 × 240 px), cantos arredondados (~16 px), espaço ~20 px entre eles.
- Topo: avatar redondo (~72 px) centralizado. Foto escolhida pela pessoa ou, se não houver, a inicial do nome do card.
- Abaixo, nesta ordem: **nome do card** (maior), **e-mail** (cinza claro), **nome real da conta** (menor, cinza mais fraco).
  Texto longo corta com reticências e mostra o texto inteiro no tooltip.
- Indicador "● aberta" quando a instância daquela conta está rodando.
- Hover: leve destaque (borda ou fundo na cor de destaque). Foco por teclado visível (Tab, Enter abre).
- O **primeiro card é sempre a conta "Principal"**: a do perfil padrão do Claude (sem `--user-data-dir`). Não pode ser removido.
- Linha única de cards. Rolagem horizontal só quando não couberem na janela.

### 2.3 Menu ⋯ do card

- **Renomear** — muda o nome do card.
- **Trocar foto** — escolhe uma imagem do PC (png/jpg/webp), recortada em círculo; opção "voltar para a inicial".
- **Remover** — com confirmação. Apaga a pasta do perfil daquela conta. Não existe no card Principal.

## 3. Visual

| Item | Definição |
|---|---|
| Tema | Escuro na v1 (o claro fica fora) |
| Fundo | Escuro quente, no tom do Claude (≈ `#262624`) |
| Superfície dos cards | Um pouco mais clara que o fundo (≈ `#30302e`) |
| Destaque | Coral (≈ `#D97757`) no ícone, hover, foco e botão |
| Texto | Creme claro (≈ `#F5F4EE`); e-mail ≈ `#B7B5AD`; nome real ≈ `#8F8D86` |
| Fonte | Serifada livre na saudação e nos nomes (ex.: Source Serif 4); sem serifa no resto (ex.: Inter) |
| Ícone | Original, inspirado numa faísca/asterisco. **Não** é o logo da Anthropic |
| Janela | ~900 × 600, redimensionável (mínimo ~720 × 480); barra de título escura (`titleBarOverlay` com as cores do tema) |

Valores com "≈" são aproximados: guardar como variáveis CSS em um só lugar para ajustar depois.

## 4. Comportamentos

1. **Clicar num card** abre aquela conta. Se ela já estiver aberta, o Claude só traz a janela para a frente
   (comportamento verificado na Fase 0). Depois de abrir, o launcher **fecha sozinho**.
2. **Adicionar conta**:
   1. a pessoa dá um nome ao card;
   2. o launcher avisa que vai fechar o Claude principal durante o login e pede confirmação;
   3. faz o fluxo de login por snapshot (`WINDOWS.md`, seção 4);
   4. detecta e-mail e nome da conta (`WINDOWS.md`, seção 5); se falhar, pede para a pessoa digitar o e-mail;
   5. reabre o Claude principal e mostra o card novo.
3. **Recuperação:** se o launcher fechar no meio de um login, na próxima abertura ele detecta e restaura o perfil principal
   antes de qualquer outra coisa.
4. **Claude não instalado** ou instalação antiga (não MSIX): mensagem clara na tela, sem erro técnico.
5. **Segurança:** tokens de sessão nunca saem do PC e nunca vão para logs.

## 5. Instalação e atualização

- Instalador NSIS por usuário, com atalho no Menu Iniciar.
- Sem atualização automática na v1: versões novas saem nos Releases do GitHub (tag `multiconta-vX.Y.Z`).
- O `.exe` não é assinado: o README explica o SmartScreen ("Mais informações → Executar assim mesmo") e o Smart App Control.

## 6. Fora da v1

Mac e Linux; tema claro; migração de tarefas agendadas e de MCP entre perfis; foto automática da conta
(só quando o Claude desktop tiver foto de perfil); mostrador de uso por conta; atualização automática.

## 7. Critérios de pronto da v1

- Instala e abre no Windows 10/11 do Thiago.
- Abre a conta Principal e pelo menos uma conta extra lado a lado, cada uma na sua conta.
- Adicionar conta funciona com login por e-mail e por Google, e o perfil principal continua intacto depois.
- Fechar o launcher no meio do login e reabrir restaura o perfil principal.
- Saudação, edição do nome, cards, menu ⋯ e indicador "● aberta" funcionam como descrito acima.

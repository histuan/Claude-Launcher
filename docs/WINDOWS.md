# Windows — fatos verificados e desenho técnico

Adaptação para Windows do guia de Mac "Run a Separate Claude Desktop App for Each Claude Account"
(chadtimbl.in), mais o que foi verificado no PC do Thiago e em projetos de terceiros.

## 1. Verificado no PC do Thiago (Fase 0, 26/10/2026, Claude 3.6556.2.0)

| Teste | Resultado |
|---|---|
| `Get-AppxPackage *Claude*` | Instalação MSIX em `C:\Program Files\WindowsApps\Claude_3.6556.2.0_x64__pzs8sxrjxfjjc` |
| `<InstallLocation>\app\Claude.exe` existe | Sim |
| Rodar o exe direto com `--user-data-dir=%USERPROFILE%\ClaudeProfiles\teste` | Abriu uma **2ª janela** isolada (tela de boas-vindas, deslogada), com a principal aberta e logada |
| Pasta do perfil | Criada e preenchida (`Cache`, `IndexedDB`, `GPUCache`...) |
| Rodar de novo com a **mesma** pasta | **Não** abriu 3ª janela. O 2º processo imprime erros de cache "Acesso negado" e sai: é ruído esperado, a trava é por pasta |
| Lista de processos `claude.exe` | 1 principal sem flag, 1 com `--user-data-dir`, e **processos do Claude Code CLI** também chamados `claude.exe` (em `%LOCALAPPDATA%\Claude-Data\...\claude-code\...`) |
| `Win32_UserAccount.FullName` | `"histuan ."` (não é o nome real; por isso a saudação é editável) |
| Saída do app no console | Avisos `MaxListenersExceededWarning` do próprio Claude: inofensivos. O launcher abre o Claude com `stdio: 'ignore'` |

## 2. Guia do Mac → Windows

| No Mac | No Windows |
|---|---|
| Nunca duplicar o `.app` | Igual. Resolver `Claude.exe` a cada abertura (a pasta muda a cada atualização do MSIX) |
| `open -n -a Claude --args --user-data-dir=...` | Rodar `Claude.exe` direto. O inicializador do pacote falha com `0x800704C7` |
| Sem trava de instância única → launcher com guarda por `ps` | Chromium trava por pasta: reabrir o mesmo perfil só foca a janela. Detecção de processo serve só para o "● aberta" |
| Perfis em `~/Library/Application Support/Claude-<Nome>` | `%USERPROFILE%\ClaudeProfiles\<id>` (fora da `AppData\Roaming`, que o MSIX virtualiza) |
| Login com só uma instância aberta | **Não funciona no Windows** (seção 4) |
| `claude_desktop_config.json` (MCP) por perfil | Igual: cada perfil começa sem MCP. Documentar no README |
| `~/.claude` compartilhado | Igual: `%USERPROFILE%\.claude` é de todas as instâncias |
| Tarefas agendadas por conta | Fora da v1 |

Pasta real do perfil padrão (MSIX redireciona `%APPDATA%\Claude`):
`%LOCALAPPDATA%\Packages\<PackageFamilyName>\LocalCache\Roaming\Claude`.
Obter `PackageFamilyName` pelo `Get-AppxPackage` (no PC do Thiago: `Claude_pzs8sxrjxfjjc`), nunca fixo no código.

Limitação conhecida: o modo agente local usa **uma VM por máquina**; só uma instância consegue usá-la por vez.

## 3. Comandos de referência (PowerShell)

```powershell
# Resolver o app
$pkg = Get-AppxPackage *Claude* | Select-Object -First 1
$pkg | Select-Object Name, Version, InstallLocation, PackageFamilyName | ConvertTo-Json

# Processos principais do Claude Desktop (filtrar pelo caminho, nunca só pelo nome)
Get-CimInstance Win32_Process -Filter "Name='claude.exe'" |
  Where-Object { $_.ExecutablePath -like '*\WindowsApps\Claude_*\app\Claude.exe' -and $_.CommandLine -notmatch '--type=' } |
  Select-Object ProcessId, CommandLine | ConvertTo-Json
```

Chamar o PowerShell com `-NoProfile -NonInteractive -Command` e pedir saída em JSON.
Fallback para instalação antiga (não MSIX): `%LOCALAPPDATA%\AnthropicClaude\claude.exe`.

## 4. Login de contas extras (fluxo por snapshot)

**Problema:** o retorno do login (`claude://`, por e-mail ou Google) é entregue pelo Windows ao **pacote MSIX**, que
sempre ativa a instância **padrão**. Um perfil extra nunca recebe o login sozinho. Redirecionar o protocolo por perfil
não é possível no Windows atual. Fonte: README do `Zoltak-Dev/ai-multi-instance` (MIT) e relato no Reddit.

**Solução** (mesma ideia do ai-multi-instance; creditar no README):

```
1. Confirmar com a pessoa → fechar todas as instâncias PADRÃO do Claude
2. Gravar marcador  %LOCALAPPDATA%\ClaudeMulticonta\login-pendente.json  (estado + caminhos)
3. STASH: renomear a pasta do perfil padrão → "Claude.multiconta-stash"   (mesmo volume: rename atômico)
4. Abrir o Claude padrão (sem flag) → nasce limpo → a pessoa faz login
5. Detectar login (automático) ou botão "Já fiz login" (fallback) ou "Cancelar"
6. Fechar o Claude padrão → mover a pasta logada → %USERPROFILE%\ClaudeProfiles\<id>
7. Desfazer o stash (renomear de volta) → apagar marcador → reabrir o Claude principal
```

Regras do fluxo:

- Antes do passo 3, conferir espaço em disco e que nenhum processo padrão está vivo (processo vivo = abortar).
- O stash **nunca** é apagado: só renomeado de volta. Se a volta falhar, parar e mostrar o caminho exato do stash.
- Ao abrir, o launcher procura o marcador **antes de tudo**. Se existir: oferecer "restaurar perfil principal" (padrão)
  ou "continuar o login".
- Cancelar em qualquer ponto = fechar o Claude padrão, apagar a pasta nova (ela é descartável) e desfazer o stash.
- **Detecção de login:** o app está logado quando existe o cookie `sessionKey`. O banco de cookies fica travado com o app
  aberto, então observar mudanças no banco de cookies e no seu `-journal`/`-wal` junto com o `config.json` do perfil
  (arquivo comum, legível com o app aberto), ignorando as escritas do início do app. Ver como o ai-multi-instance faz
  (`engine.py`) antes de inventar. Sempre manter o botão manual.
- Mover a sessão de pasta funciona: a criptografia DPAPI é por usuário do Windows, não por pasta.

## 5. Dados da conta (e-mail e nome real)

Ordem de tentativa, parando na primeira que funcionar:

1. Arquivos **locais não secretos** do perfil (ex.: `config.json`, Local Storage) que já tragam e-mail e nome.
   A nuvem não vê o PC do Thiago: a fase escreve um script de diagnóstico que lista **só chaves e caminhos, nunca valores
   de tokens**, o Thiago roda e cola a saída.
2. Cookie `sessionKey` (DPAPI + AES-GCM, via PowerShell/.NET) + endpoint não documentado do `claude.ai`
   (ver `usage.py` do ai-multi-instance). Pode quebrar com atualizações: tratar erro e cair no 3.
3. Manual: a pessoa digita o e-mail ao adicionar a conta.

Guardar só e-mail e nome no config do launcher. Nunca guardar o token.

## 6. Referências

- Guia do Mac (fonte original da ideia): chadtimbl.in/writings/claude-workflow-tips.html#multiple-accounts
- https://github.com/Zoltak-Dev/ai-multi-instance (MIT) — login por snapshot, detecção, uso por conta
- https://github.com/vodongha/claude-desktop-clone — resolução do exe MSIX em PowerShell

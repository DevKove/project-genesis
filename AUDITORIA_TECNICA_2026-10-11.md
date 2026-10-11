# Auditoria técnica abrangente — MORADA360
**Data:** 11/10/2026  
**Repositório:** `DevKove/project-genesis`  
**Ambiente Supabase:** projeto conectado ao MORADA360

## Resumo executivo

Foram revisados os módulos principais do front-end, as migrações, as políticas RLS, os buckets de arquivos, as funções privilegiadas e o pipeline de qualidade. Foram corrigidos problemas de sincronização entre banco e repositório, dependências de módulos, notificações, políticas de acesso, tipagem e ordem dos React Hooks.

**Validação automatizada mais recente:** [Quality checks — ESLint, testes e build](https://github.com/DevKove/project-genesis/actions/runs/38146710685) — sucesso.  
**Deploy mais recente:** [GitHub Pages](https://github.com/DevKove/project-genesis/actions/runs/38146710633) — sucesso.

## Correções aplicadas

1. **Sincronização das migrações:** repositório e banco agora têm 37 versões de migração correspondentes, sem versões exclusivas de um dos lados. Migrações já aplicadas foram recuperadas/realinhadas no repositório.
2. **Módulos sem estrutura no banco:** aplicadas migrações para ocorrências, solicitações de serviço, prestadores e metadados de documentos de identificação.
3. **Documentos de identificação:** confirmado o bucket privado `identity-documents`, com limite de 10 MB e tipos PDF, JPG/JPEG, PNG e WEBP. As políticas limitam leitura, envio e exclusão a gestores autorizados.
4. **Central de notificações:** criada a tabela `user_notifications`, com RLS por destinatário, índices e gatilhos para notificar administradores de novas solicitações e usuários sobre decisões. Os gatilhos foram testados transacionalmente.
5. **Políticas RLS e desempenho:** consolidadas políticas permissivas duplicadas de leitura de solicitações e atualização de perfis; adicionados índices de chaves estrangeiras de solicitações e notificações.
6. **Função administrativa temporária:** removida a função de transferência de administrador de uso único após verificar que a transferência já havia sido concluída. O registro da migração foi saneado para retirar a função temporária e seus identificadores fixos.
7. **Tipos TypeScript e fotos de perfil:** tipos regenerados a partir do schema Supabase conectado; a edição de perfis agora confirma que a linha foi atualizada e limpa arquivos de avatar temporários ou antigos quando apropriado.
8. **Painel inicial:** corrigida a chamada condicional de `useQuery`, que violava as regras de Hooks do React. Os contadores agora usam consultas tipadas e ficam desabilitados enquanto não há associação selecionada.
9. **Qualidade contínua:** o workflow passou a executar ESLint antes dos testes e do build. As regras de formatação Prettier ficam separadas do lint de correção; o script de formatação permanece disponível para execução explícita.

## Postura de segurança do banco

- **RLS ativo em 16/16 tabelas** do schema público; a consulta não encontrou tabela pública sem RLS.
- A verificação de funções `SECURITY DEFINER` nos schemas `public` e `private` não encontrou função sem `search_path` fixo.
- As políticas de leitura/atualização duplicadas apontadas pelo advisor foram consolidadas; os avisos de chaves estrangeiras sem índice foram eliminados.

## Testes executados

### Testes de banco em transações revertidas

| Área | Resultado |
|---|---|
| Ocorrências | Inserção e atualização autorizadas simuladas; transação revertida |
| Solicitações de serviço | Inserção e atualização autorizadas simuladas; transação revertida |
| Prestadores | Inserção e atualização autorizadas simuladas; transação revertida |
| Unidades | Inserção, atualização e exclusão autorizadas simuladas; transação revertida |
| Moradores | Inserção, atualização e exclusão autorizadas simuladas; transação revertida |
| Comunicados | Inserção, atualização e exclusão autorizadas simuladas; transação revertida |
| Solicitações e notificações | Gatilhos produziram notificações; a marcação como lida funcionou sob RLS; transação revertida |
| Isolamento por associação | Inserções de teste com identidade sem vínculo foram bloqueadas por RLS em ocorrências, solicitações de serviço e prestadores |
| Criação de associação | RPC de criação executada com sucesso sob identidade autorizada; transação revertida |
| Limpeza dos testes | Consulta posterior confirmou zero registros sintéticos persistidos |

Os testes foram executados com transações `BEGIN/ROLLBACK`; nenhum dado sintético de teste permaneceu nas tabelas verificadas.

### Arquivos e armazenamento

- `profile-avatars`: bucket público para exibição das fotos, limite de 2 MB, somente JPEG, PNG, WEBP e GIF; envio e exclusão restritos a administradores da plataforma.
- `association-logos`: bucket público de imagens, limite de 2 MB.
- `association-documents`: bucket privado para documentos da associação, limite de 20 MB.
- `identity-documents`: bucket privado para documentos de identificação, limite de 10 MB.
- Confirmadas as políticas de acesso e a existência dos campos de metadados de documentos em moradores e prestadores.

**Limitação:** as configurações e políticas de Storage foram verificadas no banco; não foi possível concluir um upload real pela interface web nesta auditoria.

## Alertas restantes

1. **Proteção contra senhas comprometidas desativada.** O advisor do Supabase continua sinalizando esse item. Deve ser ativada nas configurações de autenticação do projeto Supabase (proteção contra senhas vazadas/comprometidas).
2. **Funções SECURITY DEFINER expostas:** o advisor ainda lista uma função pública de consulta por código de associação e oito RPCs para usuários autenticados. Elas são usadas pelos fluxos de cadastro, convites e administração e possuem verificações de autorização; mesmo assim, devem continuar sob revisão periódica. A consulta pública por código retorna somente dados básicos da associação ativa.
3. **Índices não utilizados:** restam avisos informativos de índices ainda sem uso observado. Como a carga atual é baixa, não foram removidos automaticamente; remover índices sem métricas de produção adequadas pode prejudicar consultas futuras.
4. **Testes de navegador e estresse real:** não foi executada uma jornada E2E autenticada em navegador nem carga concorrente intensa contra produção. Isso requer contas de teste e, para estresse, um ambiente de homologação isolado. Os testes transacionais de banco não substituem esses testes.
5. **Fluxos que ainda exigem validação manual:** login por senha e Google, confirmação de e-mail, redefinição de senha, convite aceito por outro usuário, upload/download real de arquivos, permissões em duas associações com usuários reais e navegação responsiva em celular.

## Conclusão

Os problemas de sincronização de migrações, módulos sem estrutura, notificações e políticas de desempenho identificados durante a auditoria foram corrigidos no ambiente conectado e registrados no repositório. O pipeline de qualidade e o deploy mais recente passaram.

A auditoria não deve ser interpretada como certificação de que cada clique foi testado em navegador: os fluxos que dependem de uma sessão real, provedores externos, envio de arquivos ou carga concorrente permanecem explicitamente listados para homologação.


---

## Complemento da auditoria — revisão do código e CORS (11/10/2026)

Esta revisão complementar segue os critérios de `auditoria.md`. Foi feita inspeção estática dos arquivos disponíveis no branch `main`; ela não substitui execução local de scanners, testes E2E nem uma validação independente.

### Achado corrigido

**SEC-CORS-001 — Cabeçalho CORS permissivo na função de notificações**

- **Severidade:** baixa a média (configuração excessivamente permissiva; CORS não é mecanismo de autenticação).
- **Evidência anterior:** `supabase/functions/notify-association-join-request/index.ts` definia `Access-Control-Allow-Origin` como `APP_URL ?? "*"`. Se a variável estivesse ausente, a resposta de preflight e os erros retornavam origem curinga; quando configurada com uma URL contendo caminho, o valor podia não corresponder ao cabeçalho Origin do navegador.
- **Correção aplicada:** a função agora extrai a origem de `APP_URL`, permite `Access-Control-Allow-Origin` somente quando o cabeçalho `Origin` da requisição coincide exatamente com essa origem e inclui `Vary: Origin`. Origem ausente, inválida ou diferente não recebe autorização CORS.
- **Arquivo alterado:** `supabase/functions/notify-association-join-request/index.ts`.
- **Commit:** [1ef3ad5522be043951d17c7f642e8524a96ace1d](https://github.com/DevKove/project-genesis/commit/1ef3ad5522be043951d17c7f642e8524a96ace1d).
- **Reteste:** pendente enquanto os workflows de qualidade e publicação desse commit terminam. A inspeção do código confirma a restrição implementada, mas ainda não foi feito teste HTTP de preflight em ambiente implantado.

### Estado da validação automatizada

- [Quality checks do commit CORS](https://github.com/DevKove/project-genesis/actions/runs/38149854782): concluído com sucesso.
- [Deploy GitHub Pages do commit CORS](https://github.com/DevKove/project-genesis/actions/runs/38149854732): concluído com sucesso.
- O workflow Cloudflare foi marcado como ignorado para esse push; portanto, não há evidência de que a função Supabase/Edge tenha sido implantada por esse workflow.
- O último commit anterior tinha quality checks e deploy GitHub Pages concluídos com sucesso, mas isso não valida a correção CORS recém-introduzida.

### Matriz resumida dos critérios do prompt

| Área | Estado desta revisão |
|---|---|
| Inventário de arquitetura e arquivos-chave | Revisado parcialmente; aplicação React/TypeScript, TanStack Start, Supabase e workflows GitHub Actions identificados |
| Segredos no código/histórico Git | Não verificado integralmente; não foi feita varredura completa do histórico nem rotação de credenciais |
| RLS, isolamento multiassociação e RPCs | Há evidências de testes transacionais documentadas acima; testes E2E com contas reais permanecem pendentes |
| Autenticação, sessão, recuperação, MFA e rate limiting | Revisão documental/parcial; homologação ponta a ponta pendente |
| XSS, injeção, CSRF e SSRF | Não verificado de ponta a ponta; aplicabilidade depende dos fluxos reais e endpoints |
| Upload/download e autorização de arquivos | Políticas documentadas; upload/download/exclusão reais no navegador permanecem pendentes |
| CORS da função de notificação | Corrigido no código; reteste após implantação pendente |
| Cabeçalhos HTTP/CSP/HSTS | Não verificado integralmente em respostas da produção |
| Dependências e cadeia de suprimentos | Arquivo de dependências inspecionado; scanner de vulnerabilidades não executado nesta revisão |
| Lint, testes e build do commit CORS | Concluídos com sucesso no workflow vinculado; novo commit de autorização em validação |
| Testes de carga/estresse e regressão em produção | Não executados; exigem ambiente isolado e contas/dados de teste |

### Próximas ações prioritárias

1. Confirmar conclusão bem-sucedida dos workflows do commit acima e testar preflight CORS com origem permitida, origem não permitida e `APP_URL` ausente/inválida.
2. Habilitar a proteção do Supabase contra senhas comprometidas no painel de autenticação, conforme já indicado neste relatório.
3. Executar testes E2E com duas contas de teste pertencentes a associações diferentes, cobrindo autorização, convites, notificações, documentos e perfis.
4. Executar auditoria de dependências e varredura de segredos no histórico Git; não imprimir nem copiar valores secretos para os relatórios.
5. Verificar cabeçalhos HTTP reais da implantação e concluir os fluxos de recuperação de senha, Google OAuth, uploads/downloads e logout.
6. Só classificar como **corrigido e validado** após evidência de reteste; itens sem execução continuam **pendentes** ou **não verificados**.

**Conclusão complementar:** foi corrigida uma configuração CORS permissiva na função de notificações e registrado o estado de validação. A aplicação continua sem certificação de segurança completa; os itens pendentes acima precisam ser testados antes de declarar prontidão para produção.


---

## Complemento 2 — revisão adicional de autorização e estado real do ambiente (11/10/2026)

### Achado SEC-FUNC-002 — função de e-mail não verificava aprovação da conta chamadora

- **Severidade:** média.
- **Evidência:** em `supabase/functions/notify-association-join-request/index.ts`, a função validava a sessão com `auth.getUser(token)` e verificava vínculo/administrador da associação, mas não consultava o estado de aprovação da conta na tabela `profiles` antes de usar o cliente administrativo (service role).
- **Risco:** uma conta autenticada pendente/rejeitada que ainda conservasse um vínculo de administrador poderia tentar invocar diretamente a função, fora das rotas protegidas da interface.
- **Correção aplicada:** agora a função consulta `profiles.account_status` para a identidade validada e retorna HTTP 403 quando o perfil não existe, a consulta falha ou o estado não é `approved`. A verificação ocorre no servidor antes de processar o evento.
- **Commit:** [a25e0fd73f71e2bdc5867b3279e7b601cb836f0c](https://github.com/DevKove/project-genesis/commit/a25e0fd73f71e2bdc5867b3279e7b601cb836f0c).
- **Validação:** correção estática confirmada no arquivo versionado; build/testes do commit e teste HTTP da função implantada ainda precisam ser confirmados. A listagem de Edge Functions consultada no projeto Supabase não retornou funções implantadas; por isso, não considero o teste de runtime concluído.

### Verificações adicionais concluídas

- **Projeto Supabase:** confirmado que o projeto conectado é `Project-Genesis`, referência `ivajgtokxrzwnspihllr`, estado `ACTIVE_HEALTHY`.
- **RLS:** consulta direta ao catálogo do PostgreSQL encontrou RLS habilitado em todas as 16 tabelas do schema `public`. A tabela `private.association_admin_handoffs` não tem RLS, mas está no schema privado; suas permissões efetivas devem continuar sendo revistas.
- **View:** `public.association_member_directory` está configurada com `security_invoker=true` e `security_barrier=true`; SELECT não é concedido ao papel `anon`, e é concedido a `authenticated`.
- **Buckets de Storage:** `association-documents` (privado, 20 MB), `identity-documents` (privado, 10 MB), `association-logos` (público, 2 MB) e `profile-avatars` (público, 2 MB) estão configurados com listas de MIME types. A autorização de downloads e a correspondência entre MIME e conteúdo real ainda requerem testes de navegador; MIME/extensão não substituem validação de conteúdo.
- **Configuração versionada:** `.env.production` contém somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. A chave publishable é destinada ao cliente, mas deve continuar protegida por RLS e grants corretos. Não foi identificado `service_role`, `sb_secret_` ou `RESEND_API_KEY` pela busca textual no código indexado; isso não equivale a uma varredura completa de segredos no histórico.
- **CI:** o workflow Quality checks do commit de documentação `fa83c1f` concluiu com sucesso ([execução](https://github.com/DevKove/project-genesis/actions/runs/38149903090)); o deploy GitHub Pages também concluiu com sucesso ([execução](https://github.com/DevKove/project-genesis/actions/runs/38149903100)). Para o commit `a25e0fd`, os workflows foram iniciados e precisam de resultado final.

### Avisos atuais do Supabase Security Advisor

1. **Proteção contra senhas comprometidas desabilitada — pendente de configuração.** O advisor reportou que o bloqueio de senhas encontradas em vazamentos está desativado. Essa opção deve ser habilitada em Authentication/Password Security no painel do projeto; não alterei a configuração de autenticação remotamente sem uma operação administrativa específica.
2. **`lookup_association_by_code(text)` como SECURITY DEFINER executável por `anon` — revisar, não remover automaticamente.** A função retorna somente ID, nome, cidade e UF de uma associação ativa mediante código de seis dígitos; a migration mostra validação estrita do formato e `search_path` vazio. O acesso anônimo parece ser parte do fluxo de ingresso por código, portanto revogá-lo sem substituir o fluxo quebraria a funcionalidade. Permanece risco residual de enumeração automatizada de códigos; uma mitigação robusta exige rate limiting no servidor e teste do fluxo alternativo.
3. **Oito RPCs SECURITY DEFINER executáveis por `authenticated` — revisão por função necessária.** O advisor sinaliza a classe de risco, não prova isoladamente uma falha. A inspeção de algumas funções mostrou verificações de identidade, aprovação e papel; cada RPC ainda precisa de teste negativo com usuário comum, conta não aprovada e conta de outra associação.

### Matriz atualizada de estado

| Critério | Estado |
|---|---|
| CORS por allowlist de origem no código | Corrigido; workflow do commit CORS passou; teste de preflight em runtime pendente |
| Aprovação de conta na função de notificação | Corrigido no código no commit `a25e0fd`; testes automatizados e runtime pendentes |
| RLS nas tabelas públicas | Corrigido e verificado por consulta de catálogo; testes reais de isolamento multi-tenant ainda pendentes |
| View de diretório de membros | Configuração `security_invoker` verificada; testes de linha por associação pendentes |
| Buckets e limites MIME/tamanho | Configuração verificada; uploads/downloads reais e conteúdo malicioso não testados |
| Senhas comprometidas | Pendente — configuração do painel Supabase |
| RPCs SECURITY DEFINER | Revisão parcial; não marcar como aprovadas até testar cada fluxo |
| Segredos e histórico Git | Busca textual limitada sem correspondências óbvias; scanner de histórico integral não executado |
| Dependências vulneráveis | Pendente — auditoria de dependências não executada |
| CSP/HSTS/cabeçalhos HTTP em produção | Pendente — inspeção de resposta implantada não realizada |
| Rate limiting de login, RPC de código e APIs | Não verificado / requer validação e configuração no servidor |
| E2E, regressão com duas associações e estresse | Pendente |

### Próximas ações de maior prioridade

1. Confirmar os workflows do commit `a25e0fd`; depois verificar se a função está implantada no projeto correto e testar chamadas como conta aprovada, pendente, rejeitada, usuário comum e administrador de outra associação.
2. Habilitar a proteção contra senhas comprometidas no Supabase Auth.
3. Criar testes negativos automatizados para as oito RPCs SECURITY DEFINER expostas a usuários autenticados.
4. Executar scanner dedicado de dependências e de segredos/histórico, sem registrar valores secretos no relatório.
5. Testar upload/download de cada bucket com usuários de associações distintas e confirmar que arquivos privados não podem ser obtidos por URL pública.
6. Verificar cabeçalhos HTTP reais e executar testes de autenticação, recuperação, logout, OAuth, rate limiting e carga em ambiente controlado.

**Conclusão:** a auditoria continua parcial. Foram acrescentadas verificações diretas do banco e uma correção adicional de autorização no código da função de notificação. Nenhuma conclusão de auditoria completa deve ser emitida até fechar os testes pendentes e registrar evidências reproduzíveis.


### Atualização de CI após a revisão complementar

Em 11/10/2026, os workflows do commit `a25e0fd73f71e2bdc5867b3279e7b601cb836f0c` terminaram com sucesso:
- [Quality checks — lint, testes e build](https://github.com/DevKove/project-genesis/actions/runs/38150395033): **success**.
- [Deploy GitHub Pages](https://github.com/DevKove/project-genesis/actions/runs/38150395088): **success**.
- Deploy Cloudflare: **skipped**, conforme a condição do workflow.

O commit que atualizou este relatório também passou:
- [Quality checks](https://github.com/DevKove/project-genesis/actions/runs/38150466024): **success**.
- [Deploy GitHub Pages](https://github.com/DevKove/project-genesis/actions/runs/38150466039): **success**.

Esses resultados validam lint/testes/build do repositório e a publicação estática. **Não validam o runtime da Edge Function**, porque a listagem do projeto Supabase não apresentou funções implantadas; também não substituem teste HTTP de CORS, teste real de autenticação, varredura completa de dependências/segredos ou teste de carga.


### Atualização operacional — Edge Function implantada (11/10/2026)

A função `notify-association-join-request` foi implantada no projeto Supabase conectado `ivajgtokxrzwnspihllr`, usando o código versionado em `main`.

- Estado informado pelo Supabase: `ACTIVE`, versão 1.
- Verificação JWT da plataforma: habilitada (`verify_jwt=true`).
- Código implantado contém CORS por origem configurada, validação de sessão, bloqueio de perfis não aprovados e verificações de autorização por associação/evento.
- **Pendente:** teste HTTP ponta a ponta. A implantação não comprova que as variáveis de ambiente estejam completas nem que o envio de e-mail funcione.
- Testes ainda necessários: sem token (401), token inválido (401), conta não aprovada (403), usuário sem permissão (403), origem CORS permitida/não permitida e envio com destinatário de teste. Nenhum e-mail real foi enviado durante esta revisão.

A implantação fecha a pendência de ausência da função no projeto, mas não fecha a validação funcional nem a auditoria geral.


---

## Complemento 3 — conferência de workflows, grants e RPCs (11/10/2026)

### CI/CD após o último registro

O commit `484e01def4d24e393555b28cf4aaad1d634e96ed` teve os seguintes resultados:
- [Quality checks](https://github.com/DevKove/project-genesis/actions/runs/38150697530): **success**.
- [Deploy GitHub Pages](https://github.com/DevKove/project-genesis/actions/runs/38150697512): **success**.
- [Deploy Cloudflare Workers](https://github.com/DevKove/project-genesis/actions/runs/38150697540): **skipped** pela condição do workflow.

O sucesso do Pages comprova publicação estática e o workflow de qualidade comprova apenas os comandos executados por ele; nenhum dos dois comprova chamadas autenticadas à Edge Function ou testes de segurança no navegador.

### Revisão de permissões no banco

Uma consulta direta aos privilégios efetivos confirmou que as oito RPCs SECURITY DEFINER sinalizadas pelo Supabase Security Advisor têm EXECUTE concedido a `authenticated`, sem EXECUTE concedido a `anon` para essas oito funções. A exceção intencional é `lookup_association_by_code(text)`, executável por `anon` e `authenticated`, necessária ao fluxo de ingresso por código e ainda sujeita a mitigação de enumeração/rate limiting.

A tabela `private.association_admin_handoffs` tem privilégios de tabela concedidos apenas a `postgres` entre os papéis listados na consulta; não foi encontrado grant direto para `anon` ou `authenticated`. Ela permanece sem RLS, mas está no schema `private`; reavaliar se o schema e as funções auxiliares mantêm isolamento adequado sempre que a arquitetura for alterada.

A leitura das definições das oito RPCs mostrou `search_path` vazio e verificações explícitas de identidade/autoridade em seus corpos. Em particular, `admin_list_user_profiles`, `admin_update_association_member_role` e `review_account_access` exigem o papel `platform_admin` por meio de `private.has_role`; as funções de associação usam `private.has_assoc_role` ou verificações equivalentes. Essa inspeção estática não substitui testes negativos com identidades reais de teste e associações distintas.

### Logs e teste de runtime

A consulta de logs encontrou atividade geral recente em Auth, Edge, PostgREST e Storage, mas nenhuma entrada identificável de chamada à função `notify-association-join-request` na janela consultada. Portanto, **não há evidência de que os cenários HTTP da função tenham sido executados**. Não foi enviado e-mail real. Permanecem pendentes as respostas esperadas (401/403/400/502), CORS com origem permitida e bloqueada, e confirmação das variáveis de ambiente da função.

### Estado dos achados que ainda bloqueiam uma conclusão final

- **Pendente de configuração:** habilitar a proteção contra senhas comprometidas em Supabase Auth. [Orientação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- **Pendente de mitigação:** limitar enumeração de `lookup_association_by_code` e testar abuso de tentativas.
- **Pendente de verificação:** teste HTTP real da Edge Function e confirmação de configuração de e-mail, sem expor valores secretos.
- **Pendente de verificação:** scanner de dependências e varredura completa de segredos no histórico Git.
- **Pendente de verificação:** cabeçalhos HTTP/CSP/HSTS de produção e autorização real de upload/download em cada bucket com contas de associações distintas.
- **Pendente de verificação:** E2E, regressão e carga/estresse em ambiente controlado.

**Conclusão:** foram confirmados os resultados de CI/CD e os grants das RPCs. A auditoria permanece **parcial**; nenhuma evidência coletada nesta etapa autoriza declarar o sistema totalmente auditado ou certificado como seguro.

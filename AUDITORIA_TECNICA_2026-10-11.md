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

- [Quality checks do commit](https://github.com/DevKove/project-genesis/actions/runs/38149854782): em execução no momento do registro.
- [Deploy GitHub Pages do commit](https://github.com/DevKove/project-genesis/actions/runs/38149854732): em execução no momento do registro.
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
| Lint, testes e build do commit atual | Aguardando conclusão dos workflows vinculados ao commit |
| Testes de carga/estresse e regressão em produção | Não executados; exigem ambiente isolado e contas/dados de teste |

### Próximas ações prioritárias

1. Confirmar conclusão bem-sucedida dos workflows do commit acima e testar preflight CORS com origem permitida, origem não permitida e `APP_URL` ausente/inválida.
2. Habilitar a proteção do Supabase contra senhas comprometidas no painel de autenticação, conforme já indicado neste relatório.
3. Executar testes E2E com duas contas de teste pertencentes a associações diferentes, cobrindo autorização, convites, notificações, documentos e perfis.
4. Executar auditoria de dependências e varredura de segredos no histórico Git; não imprimir nem copiar valores secretos para os relatórios.
5. Verificar cabeçalhos HTTP reais da implantação e concluir os fluxos de recuperação de senha, Google OAuth, uploads/downloads e logout.
6. Só classificar como **corrigido e validado** após evidência de reteste; itens sem execução continuam **pendentes** ou **não verificados**.

**Conclusão complementar:** foi corrigida uma configuração CORS permissiva na função de notificações e registrado o estado de validação. A aplicação continua sem certificação de segurança completa; os itens pendentes acima precisam ser testados antes de declarar prontidão para produção.

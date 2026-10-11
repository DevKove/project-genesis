

## Achado de alta prioridade corrigido — permissões de perfil

Na revisão das políticas RLS e dos privilégios SQL, identifiquei que a role `authenticated` possuía permissões de INSERT/UPDATE/DELETE na tabela `public.profiles`, enquanto a política permitia atualizar a própria linha. Isso abria a possibilidade de tentar alterar campos de aprovação, como `account_status`, `approved_at`, `approved_by` e `rejection_reason`, diretamente pela API.

**Correção aplicada no banco de produção:** migração `20261011153955_restrict_profile_self_service_columns`. Foram revogados INSERT, UPDATE e DELETE em nível de tabela para `authenticated`; concedido UPDATE apenas para `full_name`, `phone`, `avatar_url` e `updated_at`.

**Verificação posterior no catálogo SQL:** INSERT/UPDATE/DELETE em nível de tabela = falso; UPDATE de `full_name` e `avatar_url` = verdadeiro; UPDATE de `account_status`, `approved_at` e `rejection_reason` = falso. A migração também foi registrada no repositório em `supabase/migrations/20261011153955_restrict_profile_self_service_columns.sql`.

A correção fecha o caminho direto de alteração desses campos via privilégios de coluna. Ainda é necessário testar o fluxo de edição do perfil no frontend e executar chamadas HTTP com JWTs de teste para confirmar que não há regressões.


## Regressão funcional encontrada durante a validação (11/10/2026)

Na tela **Gerenciar perfis**, a rotina que altera o papel de um membro chamava `db.rpc(...)`, mas o módulo não declara/importa uma variável `db`. Corrigi a chamada para usar o cliente Supabase já importado (`supabase.rpc(...)`) em commit `ca3d306d3811a67cfc58340bd40c0b422cc428c0`.

O workflow de qualidade desse commit está em execução neste momento; o lint já passou e os testes automatizados passaram, mas o build de produção ainda estava em andamento na última consulta. Portanto, a correção de código está commitada, porém a validação final depende do término do build e da publicação.

Essa revisão foi estática e baseada no código do repositório. Ainda não representa teste E2E com uma sessão administrativa real.


## Verificação complementar de segurança, Storage e CI (11/10/2026)

### Resultado do workflow de qualidade
O workflow `Quality checks` do commit `fbc6c7bcdf9d09e8d30d40df27123fc61e4b6c52` terminou com sucesso: instalação das dependências travadas, ESLint, testes automatizados e build de produção passaram. Execução: https://github.com/DevKove/project-genesis/actions/runs/38152353324. Isso confirma a qualidade automatizada do commit, não substitui testes E2E autenticados.

### Nova consulta ao Security Advisor
Na consulta mais recente, o Supabase reportou:
- 1 função SECURITY DEFINER executável por `anon`: `public.lookup_association_by_code(text)`. O acesso anônimo parece necessário ao fluxo de descoberta por código, mas o código possui apenas seis dígitos numéricos; recomenda-se adicionar limitação de tentativas/rate limiting na camada de API/Edge Function e monitorar enumeração. Não foi revogado para não quebrar o fluxo sem validar primeiro o frontend.
- 8 funções SECURITY DEFINER executáveis por `authenticated`. A inspeção das definições confirma `SET search_path TO ''` e verificações de autenticação/autorização nas funções privilegiadas; ainda é necessária validação negativa com JWTs de usuários comuns e usuários de associações diferentes.
- Proteção contra senhas comprometidas desativada no Supabase Auth. Requer ativação no painel de autenticação; não foi alterada por não haver ferramenta de configuração Auth disponível nesta sessão.

### Storage
A consulta às políticas confirma que os documentos de identidade estão restritos a gestores da associação; os documentos da associação usam associação, visibilidade e papel de gestor para autorizar leitura, e a política de upload exige correspondência entre caminho do objeto e registro de documento. Logos de associação e avatares ficam em buckets públicos, portanto os objetos podem ser obtidos por URL pública; não devem receber documentos pessoais ou conteúdo sensível. Testes de abuso de upload e acesso cruzado entre associações ainda não foram executados com contas reais.

### Estado da publicação
No momento da verificação, a execução do GitHub Pages para o commit auditado ainda estava em andamento. A publicação só deve ser considerada concluída após o workflow indicar sucesso.


## Atualização de validação — 11/10/2026

O workflow de qualidade do commit `b71081e6e481b1c4753aa5573b9c3a5385f89b47` concluiu com sucesso: dependências travadas, ESLint, testes automatizados e build de produção. Execução: https://github.com/DevKove/project-genesis/actions/runs/38152451401

O deploy do GitHub Pages desse commit também concluiu com sucesso: https://github.com/DevKove/project-genesis/actions/runs/38152451375

A pasta `src/test` contém `app-routing.test.tsx` e `setup.ts`. A suíte atual não demonstra testes dedicados de autorização entre associações, alteração de papéis, aprovação de contas, convites, documentos ou funções RPC privilegiadas. Ainda faltam testes E2E com sessões reais.

O Security Advisor ainda aponta `lookup_association_by_code(text)` executável por `anon`, oito funções SECURITY DEFINER executáveis por `authenticated` e proteção contra senhas comprometidas desativada. A função de descoberta parece necessária ao fluxo, mas requer proteção contra tentativas automatizadas. Não considero essas pendências aprovadas.


## Continuação da auditoria — verificação de RLS e funções (11/10/2026)

### RLS e privilégios
Consulta direta ao catálogo do PostgreSQL confirmou RLS habilitado nas 16 tabelas do esquema `public` (0 tabelas sem RLS). As políticas consultadas usam o usuário autenticado e funções auxiliares privadas para delimitar associação/papel; não foi encontrada política com condição literal universal `true` na varredura anterior. Isso não substitui testes com identidades reais.

### Ajuste adicional aplicado
A função `private.is_assoc_manager(uuid, uuid)` ainda estava configurada com `search_path=public`, diferente das demais funções privilegiadas. Como o corpo usa nomes de objetos qualificados por esquema, apliquei `ALTER FUNCTION ... SET search_path TO ''` no banco e registrei a migração `supabase/migrations/20261011160000_harden_private_manager_helper_search_path.sql`. Consulta posterior confirmou `search_path` vazio tanto nessa função quanto em `private.member_directory_name`.

### Revisão de funções privilegiadas
As funções `SECURITY DEFINER` em `public` consultadas fixam `search_path` vazio e verificam autenticação/autorizações conforme a operação; as auxiliares de associação e papel estão no esquema `private`, sem execução anônima. O único RPC `SECURITY DEFINER` publicamente executável por `anon` continua sendo `lookup_association_by_code(text)`, que retorna dados básicos de associações ativas para códigos numéricos de seis dígitos. A permissão foi mantida por compatibilidade do fluxo; proteção contra enumeração/rate limiting segue como risco aberto.

### Limites para conclusão definitiva
O ambiente conectado não disponibiliza configuração do Supabase Auth para ativar proteção contra senhas comprometidas e não há sessão/token de teste para contas reais de administrador, membro comum e membro de outra associação. Assim, não é possível declarar concluídos os testes negativos de autorização, E2E, upload/download cruzado ou a configuração de Auth. Esses pontos são bloqueios explícitos para uma certificação completa, não foram presumidos como aprovados.


## Testes negativos de autorização executados no banco (11/10/2026)

Foram executados em transações com `ROLLBACK`, usando `SET LOCAL ROLE` e a claim `request.jwt.claim.sub` de uma conta de papel não administrativo, sem persistir alterações:

- `private.has_assoc_role` retornou `false` quando a conta tentou consultar o papel administrativo de outro usuário.
- Tentativas de chamar `admin_update_association_member_role` e `review_account_access` com uma identidade que não é administradora da plataforma foram bloqueadas; nenhuma alteração foi persistida.
- A tentativa de atualizar diretamente `profiles.account_status` sob o papel `authenticated` foi bloqueada por privilégios de coluna/tabela.
- Sob `anon`, a leitura direta de `public.associations` foi bloqueada; a chamada pública com código malformado `abc` retornou zero resultados.

Esses são testes de autorização no banco com papéis/claims simulados e transações revertidas. Eles são mais fortes que a revisão estática, mas não substituem E2E HTTP com JWT real, teste de UI com sessão administrativa nem teste de isolamento de arquivos no Storage.


### Isolamento de perfil e estado do Storage

Em nova transação revertida, sob `authenticated`, a consulta RLS ao perfil de outro usuário retornou zero linhas; o próprio perfil permaneceu acessível. A consulta de objetos no Storage encontrou somente um objeto no bucket público `association-logos`; não havia objetos nos buckets privados para realizar um teste negativo real de download. Portanto, a política de documentos privados foi revisada estaticamente, mas a autorização de download entre usuários/associações permanece sem teste de objeto real.


## Advisor de performance — 11/10/2026

O Performance Advisor não reportou achados críticos nesta consulta; sinalizou 8 índices como não utilizados até o momento (`incidents_association_status_created_idx`, `service_requests_association_status_created_idx`, `account_access_requests_reviewed_by_idx`, `profiles_approved_by_idx`, `association_join_requests_reviewed_by_idx`, `association_join_requests_user_id_idx`, `user_notifications_association_id_idx`, `announcements_association_id_idx`). Não removi esses índices: o projeto tem pouca atividade observada e a remoção prematura pode degradar consultas futuras; reavaliar após coletar métricas de uso representativas.

## Situação de encerramento
A revisão estática, os checks de privilégios e os testes negativos SQL descritos acima foram realizados. A suíte automatizada e o deploy passaram no commit anterior; para o commit que contém esta última atualização do relatório, confirmar os workflows em Actions. A auditoria de segurança não pode ser certificada como integralmente concluída enquanto faltarem testes E2E com JWTs/contas reais, teste de acesso cruzado a objetos privados (o Storage não contém objetos privados de teste) e ativação de leaked-password protection no painel Supabase Auth.

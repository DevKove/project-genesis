

## Achado de alta prioridade corrigido — permissões de perfil

Na revisão das políticas RLS e dos privilégios SQL, identifiquei que a role `authenticated` possuía permissões de INSERT/UPDATE/DELETE na tabela `public.profiles`, enquanto a política permitia atualizar a própria linha. Isso abria a possibilidade de tentar alterar campos de aprovação, como `account_status`, `approved_at`, `approved_by` e `rejection_reason`, diretamente pela API.

**Correção aplicada no banco de produção:** migração `20261011153955_restrict_profile_self_service_columns`. Foram revogados INSERT, UPDATE e DELETE em nível de tabela para `authenticated`; concedido UPDATE apenas para `full_name`, `phone`, `avatar_url` e `updated_at`.

**Verificação posterior no catálogo SQL:** INSERT/UPDATE/DELETE em nível de tabela = falso; UPDATE de `full_name` e `avatar_url` = verdadeiro; UPDATE de `account_status`, `approved_at` e `rejection_reason` = falso. A migração também foi registrada no repositório em `supabase/migrations/20261011153955_restrict_profile_self_service_columns.sql`.

A correção fecha o caminho direto de alteração desses campos via privilégios de coluna. Ainda é necessário testar o fluxo de edição do perfil no frontend e executar chamadas HTTP com JWTs de teste para confirmar que não há regressões.


## Regressão funcional encontrada durante a validação (11/10/2026)

Na tela **Gerenciar perfis**, a rotina que altera o papel de um membro chamava `db.rpc(...)`, mas o módulo não declara/importa uma variável `db`. Corrigi a chamada para usar o cliente Supabase já importado (`supabase.rpc(...)`) em commit `ca3d306d3811a67cfc58340bd40c0b422cc428c0`.

O workflow de qualidade desse commit está em execução neste momento; o lint já passou e os testes automatizados passaram, mas o build de produção ainda estava em andamento na última consulta. Portanto, a correção de código está commitada, porém a validação final depende do término do build e da publicação.

Essa revisão foi estática e baseada no código do repositório. Ainda não representa teste E2E com uma sessão administrativa real.



## Achado adjacente: privilégios excessivos em perfis

Durante a revisão das políticas, foi identificado que a role `authenticated` tinha INSERT/UPDATE/DELETE de tabela em `public.profiles`. Isso era excessivo porque a política RLS de atualização permite que o usuário edite a própria linha. A migração `20261011153955_restrict_profile_self_service_columns` revogou os privilégios de tabela e concedeu UPDATE apenas em `full_name`, `phone`, `avatar_url` e `updated_at`.

A verificação SQL confirmou que os campos `account_status`, `approved_at` e `rejection_reason` não podem ser atualizados por `authenticated`. A alteração foi aplicada ao banco e versionada no repositório; o fluxo de edição do perfil ainda requer teste funcional no frontend.

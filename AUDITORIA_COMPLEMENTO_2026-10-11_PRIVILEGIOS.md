

## Correção adicional: privilégios de perfil (11/10/2026)

Foi identificado que usuários autenticados tinham privilégios de tabela INSERT/UPDATE/DELETE sobre `public.profiles`. Como a política de atualização permite editar a própria linha, os privilégios amplos podiam permitir tentativas de alteração de campos de estado de conta. A migração `20261011153955_restrict_profile_self_service_columns` foi aplicada no Supabase e versionada no GitHub.

Após a migração, a verificação de privilégios retornou:
- INSERT/UPDATE/DELETE de tabela por `authenticated`: negados.
- UPDATE de `full_name` e `avatar_url`: permitido.
- UPDATE de `account_status`, `approved_at` e `rejection_reason`: negado.

A tabela é criada pelo fluxo confiável de cadastro; a permissão de inserção pelo cliente foi removida. Deve-se validar o fluxo de edição do perfil no app publicado como teste de regressão antes de encerrar a auditoria.

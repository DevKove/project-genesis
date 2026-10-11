

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

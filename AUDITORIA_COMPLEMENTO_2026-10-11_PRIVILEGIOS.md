# Complemento da auditoria técnica — 11/10/2026

## Menor privilégio no banco

Foi aplicada ao projeto Supabase a migração `revoke_anon_public_table_privileges`. Ela remove privilégios diretos do papel `anon` sobre tabelas e sequências do schema `public` e ajusta os privilégios padrão do papel `postgres` para novas tabelas/sequências.

A consulta posterior de ACLs confirmou:
- zero tabelas do schema `public` com concessões diretas a `anon`;
- zero sequências do schema `public` com concessões diretas a `anon`;
- a RPC `lookup_association_by_code(text)` continua com execução anônima intencional para o fluxo de ingresso por código.

Migração: [ver arquivo no GitHub](https://github.com/DevKove/project-genesis/blob/main/supabase/migrations/20261011152511_revoke_anon_public_table_privileges.sql).

## Security Advisor

O advisor ainda informa:
- proteção contra senhas comprometidas desabilitada;
- uma RPC SECURITY DEFINER disponível a `anon` (`lookup_association_by_code`, intencional, mas sujeita a mitigação de enumeração);
- oito RPCs SECURITY DEFINER disponíveis a usuários autenticados. A leitura estática encontrou verificações de identidade/autoridade, mas ainda faltam testes negativos de autorização com contas de teste.

Não removi a RPC pública porque isso pode interromper o fluxo de cadastro antes do login. Rate limiting e testes de abuso continuam pendentes.

## Estado

Esta etapa reforçou o menor privilégio e verificou as ACLs após a alteração. A auditoria geral ainda não pode ser declarada concluída: falta habilitar a proteção de senhas comprometidas no painel Supabase, verificar a varredura de segredos no histórico Git, testar headers de produção, validar uploads/downloads com identidades de associações distintas e executar testes E2E/carga em ambiente controlado.


## Conferências adicionais

- Consulta ao catálogo confirmou zero tabelas do schema `public` sem RLS habilitado.
- Todas as tabelas públicas avaliadas tinham ao menos uma política destinada a `authenticated`.
- Pesquisas no código atual por `SUPABASE_SERVICE_ROLE_KEY`, `BEGIN PRIVATE KEY` e `RESEND_API_KEY` não retornaram correspondências. Isso **não substitui** uma varredura completa do histórico Git nem os alertas do scanner de segredos.
- A migração aplicada no Supabase está registrada com a versão `20261011152511`; o arquivo do repositório foi renomeado para corresponder exatamente a essa versão e evitar divergência de migrações.


## Armazenamento e controles de aplicação

Configuração observada diretamente no banco:
- `association-documents`: privado, limite de 20 MiB, lista explícita de MIME types.
- `identity-documents`: privado, limite de 10 MiB, apenas PDF e formatos de imagem permitidos.
- `association-logos`: público, limite de 2 MiB, imagens PNG/JPEG/WebP.
- `profile-avatars`: público, limite de 2 MiB, imagens JPEG/PNG/WebP/GIF.

As políticas de `storage.objects` para documentos privados exigem usuário autenticado e papel de gestor/membro compatível com a associação. A consulta estática das políticas não equivale a tentar baixar arquivos usando identidades reais de associações distintas. Os buckets de logos e avatares são públicos por configuração; isso significa que quem tiver uma URL válida pode acessar o objeto, algo que deve ser considerado na política de privacidade e na escolha de quais imagens podem ser carregadas.

A rota raiz do app inclui scripts e fontes externas. Não foi inserida uma CSP improvisada porque seria necessário definir e testar as diretivas contra todas as dependências reais; os cabeçalhos CSP/HSTS precisam ser validados no host final. A tentativa de chamada HTTP direta à Edge Function a partir deste ambiente não teve conectividade DNS, portanto não produziu resultado HTTP e não conta como teste.

## CI/CD

No commit `e44e691da2b58f2066b8872343006df27160a4df`, o workflow **Quality checks** terminou com sucesso. A publicação GitHub Pages estava em andamento na última consulta. O workflow Cloudflare foi ignorado por sua condição de execução.

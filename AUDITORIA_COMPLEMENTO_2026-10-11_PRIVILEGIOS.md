# Complemento da auditoria técnica — 11/10/2026

## Menor privilégio no banco

Foi aplicada ao projeto Supabase a migração `revoke_anon_public_table_privileges`. Ela remove privilégios diretos do papel `anon` sobre tabelas e sequências do schema `public` e ajusta os privilégios padrão do papel `postgres` para novas tabelas/sequências.

A consulta posterior de ACLs confirmou:
- zero tabelas do schema `public` com concessões diretas a `anon`;
- zero sequências do schema `public` com concessões diretas a `anon`;
- a RPC `lookup_association_by_code(text)` continua com execução anônima intencional para o fluxo de ingresso por código.

Migração: [ver arquivo no GitHub](https://github.com/DevKove/project-genesis/blob/main/supabase/migrations/20261011153000_revoke_anon_public_table_privileges.sql).

## Security Advisor

O advisor ainda informa:
- proteção contra senhas comprometidas desabilitada;
- uma RPC SECURITY DEFINER disponível a `anon` (`lookup_association_by_code`, intencional, mas sujeita a mitigação de enumeração);
- oito RPCs SECURITY DEFINER disponíveis a usuários autenticados. A leitura estática encontrou verificações de identidade/autoridade, mas ainda faltam testes negativos de autorização com contas de teste.

Não removi a RPC pública porque isso pode interromper o fluxo de cadastro antes do login. Rate limiting e testes de abuso continuam pendentes.

## Estado

Esta etapa reforçou o menor privilégio e verificou as ACLs após a alteração. A auditoria geral ainda não pode ser declarada concluída: falta habilitar a proteção de senhas comprometidas no painel Supabase, verificar a varredura de segredos no histórico Git, testar headers de produção, validar uploads/downloads com identidades de associações distintas e executar testes E2E/carga em ambiente controlado.

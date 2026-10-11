# Auditoria de RPCs privilegiadas — 11/10/2026

## Escopo desta rodada

Revisei as definições reais no banco de todas as funções `SECURITY DEFINER` no schema `public` retornadas pelo catálogo do PostgreSQL, além do resultado atualizado do Supabase Security Advisor.

## Controles observados na revisão estática

- `accept_invitation(uuid)` exige usuário autenticado e conta aprovada; verifica existência, estado, validade temporal, correspondência de e-mail e vínculo/autoridade do emissor; bloqueia concessão de papéis de liderança por emissores sem papel administrativo.
- `admin_list_user_profiles()` e `admin_update_association_member_role(...)` verificam papel global `platform_admin` por meio de `private.has_role` antes de executar operações privilegiadas.
- `create_association(...)` exige autenticação e conta aprovada, valida comprimento do nome, CNPJ e UF e cria o vínculo inicial de administrador no mesmo fluxo transacional.
- `request_association_membership(uuid)` exige autenticação e conta aprovada e bloqueia pedido duplicado quando o usuário já é membro.
- `review_account_access(...)` exige administrador global, valida a decisão e bloqueia solicitações que já foram analisadas.
- `review_association_join_request(...)` verifica o papel de administrador da associação indicada pela própria solicitação e impede a revisão de solicitações já processadas.
- As funções examinadas usam `SET search_path TO ''`, reduzindo risco de resolução de objetos por um caminho de busca controlado por terceiros.

Essas são conclusões de leitura estática das definições atuais. Não demonstram, por si só, que todas as combinações de permissões e estados foram testadas por HTTP com usuários reais.

## Avisos ainda ativos no Security Advisor

1. Proteção de senhas comprometidas desabilitada no Supabase Auth. É uma configuração do projeto, não algo que deva ser “corrigido” alterando código do cliente.
2. `lookup_association_by_code(text)` continua executável por `anon` e é `SECURITY DEFINER`. Isso atende ao fluxo atual de descoberta de associação no cadastro, mas permite tentativas de enumeração de códigos de seis dígitos. A RPC exige formato de seis dígitos e retorna apenas metadados básicos de associações ativas, porém não foi comprovado rate limiting no endpoint. É uma pendência de risco residual.
3. Oito RPCs `SECURITY DEFINER` são executáveis por `authenticated`. Os controles de identidade e autorização observados devem ser cobertos por testes negativos com usuários sem papel, membros de outra associação e contas não aprovadas. Não removi os grants porque isso poderia quebrar os fluxos legítimos e ainda não existe substituição testada.

## CI/CD verificado

Para o commit `85e06fd50d924e75b2c3280ebe08193baeb3e850`:
- Quality checks: sucesso — https://github.com/DevKove/project-genesis/actions/runs/38151473995
- Deploy GitHub Pages: sucesso — https://github.com/DevKove/project-genesis/actions/runs/38151473885
- Deploy Cloudflare Workers: ignorado pela condição do workflow — https://github.com/DevKove/project-genesis/actions/runs/38151473980

## Próximos passos necessários para fechar a auditoria

- Habilitar proteção contra senhas comprometidas no painel Supabase Auth e revalidar o Advisor.
- Projetar proteção contra enumeração/rate limiting para a RPC pública sem expor chaves ou credenciais privilegiadas no navegador.
- Executar testes negativos de cada RPC privilegiada com tokens de usuários de papéis distintos.
- Testar o isolamento de Storage e das tabelas entre duas associações reais.
- Realizar verificação HTTP de cabeçalhos de segurança e uma varredura completa de histórico e dependências.

**Status: auditoria parcial; não representa certificação de segurança ou pentest integral.**

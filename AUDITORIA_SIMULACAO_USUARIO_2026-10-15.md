# Auditoria de simulação de uso — Morada360x
**Data:** 15/10/2026  
**Repositório:** `DevKove/project-genesis`  
**Commit base verificado:** `f786fc1f65eb5b9c843902e109c703d065d70ed7`

## Resumo executivo

**Estado: PARCIALMENTE VERIFICADO — não certificado para produção.**

A execução mais recente do GitHub Actions confirma instalação de dependências, ESLint, testes automatizados, build de produção e build/publicação no GitHub Pages concluídos com sucesso. A suíte atual tem 4 arquivos e 17 testes: 4 em `safe-redirect`, 3 em `app-url`, 9 em `roles` e 1 de roteamento.

Isso é evidência de qualidade básica do código e do empacotamento, não uma simulação ponta a ponta de todas as ações de um usuário. Não foi possível abrir a aplicação publicada por requisição HTTP a partir do ambiente de auditoria (falha de resolução de rede) nem acessar o projeto Supabase pelo conector (erro de permissão). Por isso, não foram inventados resultados de login, CRUD ou integração.

## Evidências automatizadas

- Quality checks: https://github.com/DevKove/project-genesis/actions/runs/38735505081
- Deploy GitHub Pages: https://github.com/DevKove/project-genesis/actions/runs/38735505080
- Commit verificado: https://github.com/DevKove/project-genesis/commit/f786fc1f65eb5b9c843902e109c703d065d70ed7
- Migração Realtime de notificações adicionada ao repositório: https://github.com/DevKove/project-genesis/blob/main/supabase/migrations/20261015140000_enable_user_notifications_realtime.sql

### Resultado da suíte no CI

| Verificação | Resultado observado |
|---|---|
| Instalação bloqueada de dependências | APROVADO |
| ESLint | APROVADO; o comando terminou com sucesso, mas há warnings |
| Testes automatizados | APROVADO — 4 arquivos / 17 testes |
| Build de produção | APROVADO |
| Build estático e publicação Pages | APROVADO |
| Deploy Cloudflare Workers | IGNORADO pelo workflow; não considerar como implantado/verificado |

## Inventário de rotas e módulos identificados no repositório

Rotas públicas: início, autenticação, redefinição de senha, aguardando aprovação, privacidade, termos e cookies.

Rotas autenticadas: painel inicial, administração de aprovações, administração de perfis, assinatura/planos, auditoria, comunicados, configurações, documentos, membros, moradores, cadastro, ocorrências, prestadores, solicitações, unidades e convite.

Funções Supabase encontradas no repositório: lookup de associação por código, notificação de solicitação de ingresso, Mercado Pago (criação de pagamento e webhook) e funções legadas com nomes Asaas. A existência dos arquivos não comprova que estejam implantados ou operacionais. Nenhuma função de pagamento foi modificada nesta auditoria.

## Matriz de simulação do usuário

Legenda: **APROVADO** = existe evidência de execução; **BLOQUEADO** = não foi possível executar por falta de acesso/ambiente; **NÃO VERIFICADO** = não há evidência suficiente; **NÃO CERTIFICADO** = exige teste ponta a ponta.

| Área / cenário | Estado | Evidência ou bloqueio |
|---|---|---|
| Instalação, lint e build | APROVADO | CI mais recente concluído com sucesso |
| Funções utilitárias de URL/redirect e roles | APROVADO, escopo limitado | Testes unitários existentes |
| Correspondência de rota | APROVADO, escopo limitado | 1 teste de roteamento |
| Carregamento real da página publicada | BLOQUEADO | Requisições HTTP falharam por resolução de rede neste ambiente |
| Login Google/e-mail, logout e renovação de sessão | NÃO VERIFICADO | Exige navegador e contas de teste |
| Recuperação e redefinição de senha | NÃO VERIFICADO | Exige fluxo real de autenticação/e-mail |
| Código de associação e rate limit | NÃO VERIFICADO nesta rodada | Exige função implantada e teste HTTP com ambiente autorizado |
| Aprovação/recusa de novos acessos | NÃO VERIFICADO | Exige duas identidades e RPCs do Supabase |
| Administração de perfis e alteração de papéis | NÃO VERIFICADO | Exige identidade administradora real e verificação de autorização no banco |
| Isolamento entre associações (multi-tenant/RLS) | NÃO CERTIFICADO | Exige tokens de duas associações e tentativas de acesso cruzado |
| Unidades e moradores — criar, editar, listar e persistir | NÃO VERIFICADO | Exige sessão e banco acessíveis |
| Prestadores, comunicados, ocorrências e solicitações | NÃO VERIFICADO | Exige executar CRUD e fluxos de status na aplicação |
| Documentos e imagens de perfil | NÃO VERIFICADO | Exige upload/download real e confirmação das políticas Storage |
| Chat geral e privado | NÃO VERIFICADO | Exige duas sessões, envio e leitura em tempo real |
| Notificações e Realtime | NÃO VERIFICADO | A migração Realtime está no GitHub; não foi possível confirmar sua aplicação no Supabase |
| Auditoria e configurações | NÃO VERIFICADO | Exige ações reais e verificação dos registros persistidos |
| Planos e Mercado Pago | NÃO TESTADO ponta a ponta | Por instrução, configuração de pagamentos preservada; nenhum pagamento foi criado |
| Responsividade, teclado e acessibilidade | NÃO VERIFICADO | Não foi possível conduzir inspeção visual interativa |
| Desempenho, carga, recuperação de backup e segurança de dependências | NÃO VERIFICADO | Não executados nesta rodada |

## Bloqueios encontrados

1. **Supabase indisponível para auditoria administrativa:** chamadas de leitura de tabelas/migrações e tentativa de aplicação de migração retornaram erro de permissão. Portanto, não se pode afirmar que as migrações pendentes estejam aplicadas nem que as políticas atuais correspondam ao código.
2. **Sem acesso de rede ao site pelo ambiente de execução:** chamadas HTTP para o site e tentativa de obter o repositório diretamente falharam com erro de resolução DNS. A publicação verde no GitHub comprova o job de deploy, não o funcionamento de cada tela em um navegador.
3. **Cobertura funcional pequena em relação ao inventário:** os 17 testes existentes não cobrem cada fluxo CRUD, autenticação real, Storage, chat, notificações e isolamento multi-tenant.
4. **Avisos do lint:** o ESLint terminou com sucesso, mas o log contém warnings de Fast Refresh. Não são falhas de build, porém ainda merecem revisão.
5. **Cloudflare Workers:** o workflow correspondente foi marcado como ignorado; não é possível usar esse job como evidência de deploy funcional.

## Próxima bateria de testes necessária para concluir

Executar em staging ou com contas de teste autorizadas, sem tocar em dados reais:

1. Criar/usar contas fictícias para administrador da plataforma, gestor/presidente, morador e usuário de outra associação.
2. Percorrer login, logout, sessão expirada, recuperação de senha, código de associação e solicitação/aprovação de acesso.
3. Em cada módulo, testar lista vazia, criação, validação de campos, edição, exclusão/arquivamento quando permitido, filtros, recarga e persistência.
4. Tentar acesso direto a URLs e RPCs proibidas, alterar IDs de associação e confirmar isolamento no banco e no Storage.
5. Testar upload/download de imagens e documentos válidos/inválidos e limites de tamanho.
6. Com duas sessões, testar chat geral/privado, notificações, destinatários, leitura, atualização em tempo real e reconexão.
7. Testar falhas de rede, respostas vazias, duplo clique/envio duplicado e erros de serviço, confirmando que a UI não mostra sucesso falso.
8. Verificar Supabase: estado das migrações, RLS, políticas de Storage, funções privilegiadas, triggers e publicação Realtime.
9. Fazer testes de viewport móvel/tablet/desktop, navegação por teclado e acessibilidade.
10. Reexecutar CI e registrar resultado observado, logs e regressões.

## Proteção de escopo

- Nenhuma configuração, credencial, função ou webhook do Mercado Pago foi alterado.
- Nenhuma cobrança real foi criada.
- Não foram modificados registros reais de usuários/associações.
- Não declarar o sistema livre de bugs nem pronto para lançamento comercial enquanto os cenários bloqueados não forem executados.

## Conclusão

A verificação de CI está verde, mas a simulação completa de usuário permanece **bloqueada/parcial** por falta de acesso ao site pelo ambiente de execução e de permissões administrativas no Supabase. Para finalizar de verdade, é necessário restabelecer o acesso autorizado ao projeto Supabase correto (`ivajgtokxrzwnspihllr`) e executar os fluxos autenticados em ambiente controlado. Não compartilhar chaves secretas ou service-role keys no chat.

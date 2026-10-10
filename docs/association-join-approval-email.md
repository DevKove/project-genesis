# Aprovação de membros e notificações por e-mail

O fluxo inclui notificações persistentes dentro do Morada360 e envio opcional de e-mails por Resend. O sistema interno continua funcionando se o provedor de e-mail não estiver configurado.

## Configuração de e-mail

1. Crie uma conta no Resend e verifique o domínio/endereço remetente autorizado.
2. Gere uma API key do Resend. Não coloque essa chave em variáveis `VITE_*`, no código do frontend ou no Git.
3. Configure os secrets no projeto Supabase correto:

```sh
supabase secrets set RESEND_API_KEY=re_xxxxxxxxx
supabase secrets set RESEND_FROM_EMAIL="Morada360 <notificacoes@seudominio.com>"
supabase secrets set APP_URL=https://seudominio.com
```

Use o domínio real da aplicação em `APP_URL`. Para desenvolvimento, configure a URL local ou de preview apropriada.

4. Faça deploy da função:

```sh
supabase functions deploy notify-association-join-request
```

A função exige JWT de usuário autenticado. Ela verifica no banco se quem solicita o aviso é o candidato dono da solicitação (evento `requested`) ou um administrador da associação (evento `reviewed`). A chave de serviço fica apenas no ambiente gerenciado do Supabase.

## E-mails enviados

- Novo pedido: envia aviso aos administradores da associação.
- Pedido aprovado: avisa o candidato que o acesso foi liberado.
- Pedido recusado: informa a decisão e inclui a observação do administrador, se houver.

As chamadas usam uma chave de idempotência do Resend por solicitação, evento e destinatário para reduzir duplicações em tentativas repetidas. Falhas no provedor são mostradas na interface e não desfazem a decisão já registrada no banco.

## Banco de dados

A migração `20261010210000_association_join_approval.sql` cria a fila de solicitações, notificações internas e os gatilhos de banco. A migração deve ser revisada e aplicada pelo processo normal de migrações no projeto Supabase correto; não é aplicada automaticamente pelo deploy da função.

## Segurança e operação

- Nunca exponha `RESEND_API_KEY` nem `SUPABASE_SERVICE_ROLE_KEY` no navegador.
- Configure `APP_URL` com a origem exata do app para limitar CORS.
- Faça um teste controlado com um administrador e uma conta de teste antes de habilitar em produção.
- Verifique a entrega e a reputação do domínio no painel do Resend; envio HTTP bem-sucedido não garante entrega na caixa de entrada.

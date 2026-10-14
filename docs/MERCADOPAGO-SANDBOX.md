# Mercado Pago — isolamento de checkout de teste

## Objetivo

Permitir um teste explícito do Checkout Pro sem usar a credencial de produção, sem alterar registros de assinatura/pagamento e sem notificar o webhook financeiro.

## Segredos no Supabase

Configure em **Project Settings → Edge Functions → Secrets** (ou no gerenciamento de segredos equivalente):

- `MERCADOPAGO_ACCESS_TOKEN`: credencial usada pelo fluxo normal de produção. Não substituir durante a preparação do teste.
- `MERCADOPAGO_TEST_ACCESS_TOKEN`: credencial de teste do Mercado Pago, obtida no painel Developers. O valor deve ter o prefixo `TEST-`; não registrar o valor em arquivos, commits, logs ou chats.
- Os demais segredos existentes da aplicação permanecem inalterados.

Se `MERCADOPAGO_TEST_ACCESS_TOKEN` estiver ausente ou não começar com `TEST-`, a ação `sandbox_checkout` deve falhar fechada. Ela não pode recorrer a `MERCADOPAGO_ACCESS_TOKEN`.

## Comportamento esperado

- `action: "diagnostic"` consulta `/users/me` com a credencial normal configurada e não cria preferência ou cobrança.
- `action: "sandbox_checkout"` é restrita ao administrador da plataforma, usa somente `MERCADOPAGO_TEST_ACCESS_TOKEN`, cria uma preferência de valor baixo exclusivamente para teste e retorna somente `sandbox_init_point`.
- O checkout de sandbox não inclui `notification_url`, não grava em `mercadopago_subscription_payments` e não altera assinaturas.
- O fluxo normal de cobrança exige uma credencial `APP_USR-` e continua usando apenas `MERCADOPAGO_ACCESS_TOKEN`. Não há fallback entre credenciais ou URLs de checkout.
- O webhook de produção continua consultando pagamentos com a credencial de produção. Eventos sandbox não devem atualizar pagamentos locais; a referência sintética `sandbox-...` não corresponde a um UUID de pagamento local e deve ser ignorada.

## Plano de verificação antes de publicar

1. Revisar o diff da branch `fix/mercadopago-sandbox-isolation`.
2. Confirmar que nenhum token real foi adicionado ao Git.
3. Configurar `MERCADOPAGO_TEST_ACCESS_TOKEN` diretamente nos segredos do Supabase, sem substituir o segredo de produção.
4. Fazer deploy da Edge Function apenas após revisão explícita.
5. Testar com um usuário que tenha a função `platform_admin`:
   - Sem token de teste: retorno seguro de erro, sem fallback.
   - Com token de teste válido: URL `sandbox_init_point`, nunca `init_point`.
   - Verificar que não houve inserção/alteração nas tabelas de pagamentos ou assinaturas.
   - Confirmar que o checkout de teste não envia webhook financeiro.
6. Executar os testes automatizados disponíveis e registrar os resultados reais.
7. Só depois da validação, decidir separadamente se deve ser aberto PR ou publicado.

## Limites

Criar uma preferência de teste ainda faz uma requisição ao Mercado Pago, mas não deve gerar cobrança real se a credencial for de teste e a URL retornada for exclusivamente de sandbox. Não confirmar pagamentos com base apenas no retorno do navegador.

# Mercado Pago — isolamento de checkout de teste

## Objetivo

Permitir um teste explícito do Checkout Pro sem usar a credencial de produção, sem alterar registros de assinatura/pagamento e sem notificar o webhook financeiro.

## Segredos no Supabase

Configure em **Project Settings → Edge Functions → Secrets** (ou no gerenciamento de segredos equivalente):

- `MERCADOPAGO_PRODUCTION_ACCESS_TOKEN`: credencial de produção usada somente pelo fluxo normal de cobrança e pelo webhook. Não substituir durante a preparação do teste.
- `MERCADOPAGO_TEST_ACCESS_TOKEN`: credencial de teste do Mercado Pago, obtida no painel Developers. Use a credencial identificada como **credencial de teste** no painel Developers do Mercado Pago. Não determine o ambiente apenas pelo prefixo (inclusive `APP_USR`); não registre o valor em arquivos, commits, logs ou chats.
- Os demais segredos existentes da aplicação permanecem inalterados.

Se `MERCADOPAGO_TEST_ACCESS_TOKEN` estiver ausente, a ação `sandbox_checkout` deve falhar fechada. Ela não pode recorrer à credencial de produção.

## Comportamento esperado

- `action: "diagnostic"` consulta `/users/me` com a credencial normal configurada e não cria preferência ou cobrança.
- `action: "sandbox_checkout"` é restrita ao administrador da plataforma, usa somente `MERCADOPAGO_TEST_ACCESS_TOKEN`, cria uma preferência de valor baixo exclusivamente para teste e retorna somente `sandbox_init_point`.
- O checkout de sandbox não inclui `notification_url`, não grava em `mercadopago_subscription_payments` e não altera assinaturas.
- O fluxo normal de cobrança usa somente `MERCADOPAGO_PRODUCTION_ACCESS_TOKEN`. O prefixo da credencial não é usado como único critério para distinguir ambiente. Não há fallback entre credenciais ou URLs de checkout.
- O webhook de produção continua consultando pagamentos com a credencial de produção. Eventos sandbox não devem atualizar pagamentos locais; a referência sintética `sandbox-...` não corresponde a um UUID de pagamento local e deve ser ignorada.

## Pagamento via Pix

A tela de assinatura agora oferece opções separadas de **Pix** e **cartão**. O Pix usa a API de pagamentos `POST /v1/payments` com `payment_method_id: "pix"`, o CPF do responsável financeiro já registrado na assinatura e o e-mail de faturamento. O servidor retorna QR Code, código Pix Copia e Cola e, quando fornecido, o link de instruções (`ticket_url`). A confirmação do pagamento continua dependendo do webhook validado e da consulta do pagamento no Mercado Pago.

- O sistema impede gerar um segundo meio de pagamento enquanto houver uma cobrança pendente para o mesmo período.
- O CPF é enviado apenas do servidor para o Mercado Pago; não é incluído em parâmetros públicos ou na URL.
- A criação de Pix com a credencial de produção pode gerar uma cobrança real. **Não testar o botão de Pix em produção para validar a integração.**
- Nenhum teste Pix real foi executado durante esta alteração. O teste sandbox já existente cobre o Checkout Pro; a verificação end-to-end do Pix requer credenciais e dados de comprador de teste compatíveis com a conta do Mercado Pago.
- A URL de checkout e o QR Code são apresentados apenas após a resposta da API. A assinatura não deve ser considerada paga com base no retorno do navegador; somente o evento confirmado no webhook pode atualizar o pagamento.

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

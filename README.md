# Project Genesis

faça a criação completa, ou seja 100% e integral do projeto anexo

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4c604b61-f515-4904-92f5-d398502fe59d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## Deploy em produção — Cloudflare Workers

O Morada360 usa TanStack Start com renderização no servidor (SSR). Por isso, o GitHub Pages estático não é o destino adequado para a aplicação completa. O repositório contém agora a configuração de implantação no Cloudflare Workers e um workflow do GitHub Actions.

### Configuração necessária (uma única vez)

1. Crie/acesse uma conta Cloudflare e abra **Workers & Pages**.
2. Em **My Profile → API Tokens**, crie um token com permissões de implantação de Workers (e acesso à conta correspondente). Não publique esse token nem o envie no chat.
3. No GitHub, abra **Settings → Secrets and variables → Actions** deste repositório.
4. Em **Secrets**, crie:
   - `CLOUDFLARE_API_TOKEN` — token de implantação Cloudflare.
   - `CLOUDFLARE_ACCOUNT_ID` — ID da conta Cloudflare.
5. Em **Variables**, crie `ENABLE_CLOUDFLARE_DEPLOY` com o valor `true`.
6. Salve. A próxima execução do workflow **Deploy Morada360 to Cloudflare Workers** fará testes, build e implantação. Também é possível iniciá-lo manualmente em **Actions**.

### Supabase

A configuração pública do cliente está em `.env.production` com a URL do projeto e a chave *publishable*. Essa chave é destinada ao cliente e não substitui as regras de segurança do banco. Nunca coloque chaves `sb_secret_`, `service_role` ou senhas no código.

Antes de usar dados reais, confirme no Supabase que as tabelas necessárias existem e que RLS e políticas de acesso isolam corretamente os dados por usuário/condomínio. O acesso administrativo à configuração remota do projeto não estava disponível durante a preparação, portanto essas políticas ainda não foram auditadas.

### Verificação

O workflow **Quality checks** executa instalação reproduzível usando o arquivo `bun.lock`, testes automatizados e build de produção. A implantação só é executada quando `ENABLE_CLOUDFLARE_DEPLOY=true`, evitando falhas de publicação enquanto as credenciais ainda não foram cadastradas.

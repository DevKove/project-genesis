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

O projeto Supabase selecionado para o MORADA360 é `ivajgtokxrzwnspihllr`.

- Para desenvolvimento local, copie `.env.example` para `.env` e preencha os valores do projeto selecionado.
- `.env` e arquivos locais equivalentes são ignorados pelo Git. Não versione credenciais locais.
- `.env.production` é usado pelo fluxo de build estático existente e contém somente a URL pública e a chave *publishable*. Não coloque chaves `sb_secret_`, `service_role` ou senhas em arquivos `VITE_*`.
- A chave *publishable* não substitui RLS nem autorização no servidor. Toda operação de dados deve continuar sujeita às políticas do banco e aos controles de autorização.
- `SUPABASE_SERVICE_ROLE_KEY`, se estritamente necessária a uma operação confiável do servidor, deve ser configurada somente no ambiente seguro do servidor/CI e nunca exposta ao navegador ou comprometida no repositório.
- O banco remoto é administrado separadamente das alterações do repositório. Não aplique migrações nem altere configurações de Auth/Storage sem revisar o SQL, confirmar o projeto e verificar o resultado.

Antes de usar dados reais, execute os testes de isolamento com duas contas autenticadas em associações diferentes, revise RLS e políticas de Storage e valide os fluxos de autenticação. O status e as pendências atuais estão registrados em `SECURITY_AUDIT.md`; o sistema não deve ser considerado pronto para produção até que os itens pendentes sejam comprovados.

### Verificação

O workflow **Quality checks** executa instalação reproduzível usando o arquivo `bun.lock`, testes automatizados e build de produção. A implantação só é executada quando `ENABLE_CLOUDFLARE_DEPLOY=true`, evitando falhas de publicação enquanto as credenciais ainda não foram cadastradas.

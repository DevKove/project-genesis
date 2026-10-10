<!-- MORADA360 — README principal -->

<div align="center">

# 🏡 MORADA360

### Gestão de associações de moradores em um só lugar

**Uma base tecnológica para organizar pessoas, unidades, serviços, documentos e rotinas administrativas de comunidades residenciais.**

[Visão geral](#-visão-geral) · [Arquitetura](#️-arquitetura) · [Instalação](#-instalação-local) · [Configuração](#-variáveis-de-ambiente) · [Testes](#-testes-e-qualidade) · [Deploy](#-implantação)

![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![TanStack Start](https://img.shields.io/badge/TanStack_Start-SSR-ff4154)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%7C%20Auth-3fcf8e?logo=supabase&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare%20Workers-f38020?logo=cloudflare&logoColor=white)
![Licença](https://img.shields.io/badge/licença-a%20definir-lightgrey)

</div>

---

## 📚 Índice

- [Visão geral](#-visão-geral)
- [Objetivos do produto](#-objetivos-do-produto)
- [Funcionalidades e escopo](#-funcionalidades-e-escopo)
- [Arquitetura](#️-arquitetura)
- [Tecnologias](#-tecnologias)
- [Requisitos](#-requisitos)
- [Instalação local](#-instalação-local)
- [Variáveis de ambiente](#-variáveis-de-ambiente)
- [Banco de dados e migrações](#-banco-de-dados-e-migrações)
- [Comandos úteis](#-comandos-úteis)
- [Testes e qualidade](#-testes-e-qualidade)
- [Implantação](#-implantação)
- [Segurança e privacidade](#-segurança-e-privacidade)
- [Estrutura do repositório](#-estrutura-do-repositório)
- [Contribuição](#-fluxo-de-contribuição)
- [Roadmap](#-roadmap)
- [Solução de problemas](#-solução-de-problemas)
- [Documentação complementar](#-documentação-complementar)

## 🌐 Visão geral

O **MORADA360** é um projeto de plataforma SaaS para apoiar a administração de associações de moradores, bairros organizados, loteamentos e comunidades residenciais. A proposta é reunir em um ambiente organizado as rotinas de gestão, os cadastros e os serviços de cada associação.

A arquitetura está sendo construída para permitir que várias associações usem a mesma plataforma, com usuários, registros e permissões separados por associação. A aplicação utiliza React com TypeScript, TanStack Start, Supabase e implantação SSR planejada para Cloudflare Workers.

> **Estado do projeto:** este repositório contém uma aplicação em desenvolvimento e uma visão de produto mais ampla descrita em [instrucoes.md](./instrucoes.md). A documentação separa funcionalidades existentes, arquitetura e objetivos futuros. A presença de um módulo no escopo não significa que todos os seus fluxos estejam concluídos ou homologados. Consulte [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) e os resultados de CI antes de usar dados reais.

## 🎯 Objetivos do produto

- Centralizar informações administrativas de cada associação.
- Organizar cadastros de moradores, unidades e prestadores.
- Registrar solicitações, ocorrências e acompanhamentos.
- Manter documentos vinculados aos cadastros, com acesso controlado.
- Preparar uma base extensível para módulos financeiros e de governança.
- Estabelecer uma arquitetura multiassociação com autorização no servidor e políticas de banco.
- Evoluir para um produto SaaS com planos e recursos habilitados conforme a assinatura.

## 🧩 Funcionalidades e escopo

A tabela apresenta as principais áreas do produto. Ela descreve o escopo de desenvolvimento; não certifica que todos os recursos estejam concluídos.

| Área | Objetivo |
|---|---|
| 🏘️ Associações e unidades | Organizar os dados institucionais e a estrutura territorial de cada comunidade. |
| 👥 Moradores | Manter cadastros e vínculos residenciais, respeitando permissões de acesso. |
| 🧰 Prestadores | Registrar profissionais/empresas e informações necessárias à prestação de serviços. |
| 📝 Solicitações e ocorrências | Registrar demandas, acompanhar status e manter histórico de atendimento. |
| 📎 Documentos | Associar arquivos a registros quando habilitado, com validação e acesso controlado. |
| 📣 Comunicados | Preparar a divulgação de informações relevantes para a comunidade. |
| 💳 Financeiro | Planejado para receitas, despesas, cobranças, aprovações e relatórios. |
| 🗳️ Governança | Planejado para assembleias, atas, eleições e votações conforme regras da associação. |
| 🔐 Usuários e permissões | Controlar o acesso conforme identidade, associação e função autorizada. |
| 📊 Relatórios e auditoria | Dar visibilidade a atividades e operações permitidas, com trilhas auditáveis. |
| 🧾 Administração SaaS | Planejada para planos, assinaturas, limites e suporte da plataforma. |

### Documentos de identificação

A implementação de cadastro de pessoas prevê um campo opcional para documento com foto nos formulários de moradores e prestadores. Os formatos aceitos nessa implementação são **PDF, JPG/JPEG, PNG e WEBP**, com limite de **10 MB por arquivo**. A integração depende de a migração e a configuração de Storage correspondentes estarem aplicadas no ambiente utilizado. A existência de uma migração no repositório não significa que a configuração remota do Supabase foi atualizada.

## 🗺️ Visão visual da plataforma

O diagrama resume a separação funcional desejada:

~~~~mermaid
flowchart TD
    A["MORADA360"] --> B["Administração SaaS"]
    A --> C["Ambiente da associação"]
    C --> D["Gestão de pessoas e unidades"]
    C --> E["Solicitações e ocorrências"]
    C --> F["Documentos e comunicados"]
    C --> G["Financeiro e governança"]
    C --> H["Relatórios e auditoria"]
    D --> I["Moradores / proprietários / ocupantes"]
    E --> J["Equipe administrativa / prestadores"]
    G --> K["Perfis autorizados"]
~~~~

*O diagrama representa o desenho funcional do produto, não afirma que todas as áreas estejam finalizadas.*

## 🏗️ Arquitetura

### Visão técnica

~~~~mermaid
flowchart LR
    U["Navegador"] --> UI["React + TypeScript"]
    UI --> APP["TanStack Start"]
    APP --> AUTH["Supabase Auth"]
    APP --> DB["Supabase / PostgreSQL"]
    DB --> RLS["RLS e políticas de acesso"]
    APP --> SSR["Runtime SSR"]
    SSR --> CF["Cloudflare Workers"]
    CI["GitHub Actions"] --> Q["Testes + build"]
    Q --> CF
~~~~

- **Frontend:** React e TypeScript.
- **Aplicação e roteamento:** TanStack Start / TanStack Router.
- **Dados e autenticação:** Supabase, PostgreSQL e Supabase Auth.
- **Estilos e componentes:** Tailwind CSS, Radix UI e componentes da aplicação.
- **Validação de formulários:** React Hook Form e Zod, conforme os módulos.
- **Testes:** Vitest e Testing Library.
- **Build:** Vite.
- **Runtime SSR e destino recomendado:** Nitro em Cloudflare Workers.
- **Automação:** GitHub Actions para testes, build e publicação.

O código e as configurações do repositório são a referência final para versões e comandos. Não adicione outro sistema de build ou plugin sem avaliar o impacto na configuração existente.

### Multi-tenancy e autorização

A aplicação tem como requisito separar os dados por associação. O escopo deve ser resolvido a partir da sessão e dos vínculos autorizados, com autorização no servidor e regras complementares no banco. **Esconder menus no frontend não é um controle de segurança suficiente.**

~~~~mermaid
flowchart TD
    R["Requisição autenticada"] --> S["Validar sessão"]
    S --> M["Resolver vínculo e função"]
    M --> T["Determinar associação autorizada"]
    T --> P["Aplicar autorização no servidor e no banco"]
    P -->|Permitido| D["Executar operação no escopo autorizado"]
    P -->|Negado| X["Recusar acesso"]
    D --> L["Registrar auditoria quando aplicável"]
~~~~

Este é o fluxo de referência. A conformidade de cada endpoint, tabela, função e política deve ser verificada por testes e revisão de segurança.

## 🧰 Tecnologias

| Tecnologia | Uso |
|---|---|
| React 19 | Interface baseada em componentes |
| TypeScript | Tipagem estática |
| TanStack Start | Aplicação web e renderização no servidor |
| TanStack Router | Rotas e navegação |
| Vite | Desenvolvimento e build |
| Supabase | Autenticação, PostgreSQL e recursos de backend |
| Tailwind CSS | Estilização |
| Radix UI | Primitivos de interface acessíveis |
| React Hook Form + Zod | Formulários e validação |
| Vitest + Testing Library | Testes automatizados |
| Bun | Gerenciamento de dependências e scripts |
| Cloudflare Workers + Nitro | Destino previsto para execução SSR |
| GitHub Actions | Integração contínua e implantação |

## 💻 Requisitos

Antes de iniciar, instale:

- **Git** — para obter o código.
- **Bun** — versão compatível com o lockfile e o workflow de CI.
- **Conta/projeto Supabase** — para recursos que dependem de autenticação e banco.
- **Node.js compatível** — necessário para ferramentas do ecossistema e dependências, conforme o ambiente.

Links oficiais: [Bun](https://bun.sh/docs/installation), [Git](https://git-scm.com/downloads), [Supabase](https://supabase.com/docs) e [Cloudflare Workers](https://developers.cloudflare.com/workers/).

## 🚀 Instalação local

### 1. Clonar o repositório

~~~~bash
git clone https://github.com/DevKove/project-genesis.git
cd project-genesis
~~~~

### 2. Instalar as dependências

Use Bun e preserve o lockfile:

~~~~bash
bun install --frozen-lockfile
~~~~

Se estiver trabalhando em uma branch que alterou dependências, verifique o diff do lockfile e siga as instruções do CI.

### 3. Criar o arquivo de ambiente

No Windows PowerShell:

~~~~powershell
Copy-Item .env.example .env
~~~~

No Linux/macOS:

~~~~bash
cp .env.example .env
~~~~

Abra o arquivo <code>.env</code> e preencha as variáveis necessárias com os dados do seu ambiente Supabase. Veja [Variáveis de ambiente](#-variáveis-de-ambiente).

### 4. Iniciar o servidor de desenvolvimento

~~~~bash
bun run dev
~~~~

Abra no navegador o endereço local informado pelo Vite no terminal (normalmente <code>http://localhost:3000</code>, mas use o endereço efetivamente exibido).

### 5. Validar alterações

~~~~bash
bun run test
bun run build
~~~~

Execute também o lint quando necessário:

~~~~bash
bun run lint
~~~~

## 🔐 Variáveis de ambiente

O arquivo [<code>.env.example</code>](./.env.example) é o modelo de referência. Os valores abaixo são exemplos de formato, não credenciais utilizáveis.

| Variável | Uso | Exposição |
|---|---|---|
| <code>VITE_SUPABASE_URL</code> | URL do projeto Supabase no cliente | Pública |
| <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> | Chave publishable usada pelo cliente | Pública, conforme o modelo de chaves do Supabase |
| <code>VITE_SUPABASE_PROJECT_ID</code> | Identificador do projeto usado pelo cliente/configuração | Pública |
| <code>SUPABASE_URL</code> | URL do projeto para o runtime do servidor | Configuração de servidor |
| <code>SUPABASE_PUBLISHABLE_KEY</code> | Chave publishable para o runtime do servidor | Configuração de servidor |
| <code>SUPABASE_SERVICE_ROLE_KEY</code> | Somente para recursos confiáveis do servidor que precisem dela | **Secreta; nunca expor ao navegador** |

### Regras para segredos

- Nunca faça commit do arquivo <code>.env</code> ou de credenciais reais.
- Nunca coloque service-role keys, senhas de banco ou tokens em variáveis com prefixo <code>VITE_</code>.
- A chave publishable não substitui políticas RLS nem autorização no servidor.
- Não cole tokens, chaves secretas ou senhas em issues, pull requests ou conversas.
- Use valores e projetos separados para desenvolvimento e produção.
- Se uma credencial for publicada por engano, revogue-a/rotacione-a imediatamente.

O projeto Supabase selecionado no momento desta documentação é <code>ivajgtokxrzwnspihllr</code>. Confirme o projeto de destino antes de executar operações administrativas. A configuração remota de banco, Auth e Storage é separada dos arquivos versionados neste repositório.

## 🗄️ Banco de dados e migrações

As migrações SQL versionadas ficam em <code>supabase/migrations/</code>. Antes de aplicar qualquer alteração:

1. Leia a migração completa e suas dependências.
2. Confirme que o projeto Supabase de destino é o correto.
3. Revise impacto em tabelas, funções, triggers, grants, RLS e Storage.
4. Planeje como validar e recuperar a operação caso ocorra falha.
5. Aplique em desenvolvimento/homologação primeiro, quando disponível.
6. Execute testes funcionais e de autorização após a aplicação.

**Não aplique migrações remotas automaticamente apenas porque o arquivo está no Git.** A existência de SQL no repositório não significa que ele já foi executado no Supabase. Para produção, siga o processo de revisão e autorização do projeto.

### Regras essenciais para dados

- Toda tabela com dados de associação precisa de escopo de acesso revisado.
- Use chaves estrangeiras e restrições para manter a integridade.
- Evite exclusão silenciosa de registros financeiros ou auditáveis.
- Limite o acesso a dados pessoais e documentos ao mínimo necessário.
- Teste explicitamente tentativas de leitura e escrita entre associações.

## 🧪 Comandos úteis

Os comandos disponíveis no <code>package.json</code> incluem:

| Comando | Finalidade |
|---|---|
| <code>bun run dev</code> | Iniciar o ambiente local |
| <code>bun run build</code> | Gerar build de produção da aplicação principal |
| <code>bun run build:dev</code> | Gerar build no modo de desenvolvimento |
| <code>bun run preview</code> | Visualizar o build Vite conforme a configuração do projeto |
| <code>bun run test</code> | Executar os testes automatizados uma vez |
| <code>bun run test:watch</code> | Executar testes em modo de observação |
| <code>bun run lint</code> | Executar ESLint |
| <code>bun run format</code> | Formatar arquivos com Prettier |

Os comandos de teste/build podem depender de variáveis de ambiente válidas. Registre o resultado real de cada execução; não considere uma etapa aprovada apenas porque o comando foi iniciado.

## ✅ Testes e qualidade

O workflow **Quality checks** executa instalação reproduzível, testes e build conforme a configuração do repositório. A implantação também possui seus próprios passos de validação.

Antes de liberar uma versão, verifique:

- [ ] Instalação reproduzível a partir do lockfile.
- [ ] Testes automatizados aprovados na revisão/commit em questão.
- [ ] Build de produção aprovado.
- [ ] Fluxos de autenticação e recuperação de sessão validados.
- [ ] Permissões verificadas no servidor e no banco.
- [ ] Testes de isolamento entre duas associações diferentes.
- [ ] Upload/download de documentos privados testado com usuários autorizados e não autorizados.
- [ ] Migrações revisadas e aplicadas no ambiente correto.
- [ ] Logs e mensagens de erro não revelam dados sensíveis.
- [ ] Procedimentos de backup e restauração verificados.

Uma execução de CI comprova somente as verificações realizadas por aquele workflow; não representa, isoladamente, uma auditoria completa de segurança ou homologação funcional de todos os módulos.

## ☁️ Implantação

### Cloudflare Workers — destino SSR recomendado

O MORADA360 usa TanStack Start com renderização no servidor. Para a aplicação completa, o destino previsto no repositório é **Cloudflare Workers**, usando Nitro e a configuração [<code>wrangler.jsonc</code>](./wrangler.jsonc).

#### Configuração inicial

1. Tenha uma conta Cloudflare e identifique a conta de destino.
2. Crie um API Token com as permissões necessárias para implantar Workers. Restrinja o escopo ao mínimo necessário.
3. No GitHub, abra **Settings → Secrets and variables → Actions** do repositório.
4. Em **Secrets**, configure:
   - <code>CLOUDFLARE_API_TOKEN</code> — token da implantação.
   - <code>CLOUDFLARE_ACCOUNT_ID</code> — identificador da conta Cloudflare.
5. Em **Variables**, configure <code>ENABLE_CLOUDFLARE_DEPLOY</code> com o valor literal <code>true</code>.
6. Abra **Actions** e acompanhe o workflow **Deploy Morada360 to Cloudflare Workers**.
7. Confirme o resultado da execução e teste o endereço publicado.

O workflow está condicionado a <code>ENABLE_CLOUDFLARE_DEPLOY == 'true'</code>. Se a variável não estiver configurada, a implantação é ignorada. Não compartilhe o conteúdo dos secrets.

#### Fluxo de implantação

~~~~mermaid
flowchart TD
    A["Push na main ou execução manual"] --> B["Instalar dependências com lockfile"]
    B --> C["Executar testes"]
    C --> D["Gerar build de produção"]
    D --> E["Validar secrets Cloudflare"]
    E --> F["Implantar com Nitro"]
    F --> G["Verificar aplicação publicada"]
~~~~

### GitHub Pages — build estático

O repositório também contém um workflow de GitHub Pages que constrói uma versão SPA estática com <code>vite.config.github.ts</code>. Essa publicação pode ser útil para pré-visualização, mas **não substitui o runtime SSR do Cloudflare Workers para a aplicação completa**. Recursos que dependem de execução no servidor devem ser validados no destino apropriado.

Se o código já estiver na <code>main</code>, mas o site não refletir a mudança, verifique:

1. Se o commit esperado está na branch publicada.
2. Se o workflow correto foi executado.
3. Se o workflow terminou com sucesso ou foi ignorado por condição.
4. Se o endereço acessado corresponde ao ambiente que recebeu o deploy.
5. Se uma atualização forçada do navegador (<code>Ctrl + F5</code>) resolve o cache.

## 🛡️ Segurança e privacidade

O MORADA360 pode lidar com dados pessoais, documentos e informações administrativas. Segurança precisa ser validada continuamente, não presumida pela tecnologia escolhida.

### Princípios

- **Menor privilégio:** cada perfil recebe somente os acessos necessários.
- **Autorização no servidor:** a interface não é uma fronteira de segurança.
- **Isolamento por associação:** impedir leitura, alteração, exclusão e exportação cruzadas.
- **RLS:** revisar políticas por tabela e operação.
- **Arquivos privados:** não tornar documentos pessoais publicamente acessíveis; usar URLs temporárias somente após autorização.
- **Validação de entrada:** validar dados no servidor e impor restrições no banco.
- **Segredos protegidos:** nunca versionar tokens, senhas ou chaves privadas.
- **Auditoria:** registrar operações críticas sem incluir segredos ou dados pessoais desnecessários.
- **LGPD:** documentar finalidade, base legal, retenção, direitos dos titulares e resposta a incidentes.

### Antes de usar dados reais

Leia o [relatório técnico de auditoria](./SECURITY_AUDIT.md). O relatório descreve verificações e pendências observadas no momento da auditoria; não é garantia permanente de segurança. Refaça as verificações após mudanças relevantes em banco, políticas, autenticação, armazenamento ou autorização.

**Não considere o sistema pronto para produção com dados reais até que os controles pendentes sejam revisados, os testes de isolamento sejam aprovados e a implantação seja validada no ambiente final.**

## 🗂️ Estrutura do repositório

A estrutura resumida abaixo indica os diretórios principais. Arquivos e módulos podem mudar durante o desenvolvimento.

~~~~text
project-genesis/
├── .github/
│   └── workflows/          # CI e workflows de implantação
├── public/                 # Arquivos estáticos públicos
├── src/
│   ├── routes/             # Rotas e telas da aplicação
│   ├── components/         # Componentes de interface
│   ├── lib/                # Utilitários e integrações
│   └── ...                 # Outros módulos
├── supabase/
│   ├── migrations/         # Migrações SQL versionadas
│   └── config.toml         # Configuração do Supabase CLI
├── .env.example            # Modelo de variáveis locais
├── bun.lock                # Lockfile de dependências
├── package.json            # Scripts e dependências
├── vite.config.ts          # Configuração principal
├── vite.config.github.ts   # Build SPA para GitHub Pages
├── wrangler.jsonc          # Configuração Cloudflare Workers
├── instrucoes.md           # Escopo funcional e requisitos do produto
├── SECURITY_AUDIT.md       # Auditoria técnica e pendências
└── README.md               # Este documento
~~~~

## 🤝 Fluxo de contribuição

Para preservar a estabilidade do projeto:

1. Consulte [instrucoes.md](./instrucoes.md) e a documentação técnica relevante.
2. Crie uma branch descritiva a partir da base atualizada.
3. Inspecione os módulos existentes antes de alterar comportamento.
4. Faça alterações pequenas e focadas, sem apagar funcionalidades não relacionadas.
5. Execute testes, lint e build aplicáveis.
6. Revise migrações, políticas de acesso e variáveis de ambiente.
7. Abra um Pull Request com contexto, arquivos alterados, testes executados e limitações conhecidas.
8. Aguarde as verificações de CI e revisão antes de mesclar.

Não faça force-push, não reescreva o histórico publicado e não inclua segredos, dados reais de moradores ou documentos pessoais em commits e testes.

### Modelo para Pull Request

- **Objetivo:** qual problema a alteração resolve?
- **Mudanças:** quais telas, serviços, políticas ou migrações foram modificados?
- **Validação:** quais comandos foram executados e qual foi o resultado?
- **Banco/infraestrutura:** há migração ou configuração remota necessária?
- **Segurança:** foram verificados autorização, RLS, tenant e dados pessoais?
- **Limitações:** o que continua pendente?

## 🛣️ Roadmap

O escopo de longo prazo está detalhado em [instrucoes.md](./instrucoes.md). A evolução está organizada em etapas:

| Etapa | Objetivo |
|---|---|
| 1 — Fundação | Arquitetura, autenticação, autorização, multi-tenancy, auditoria e testes-base |
| 2 — Associação e usuários | Cadastro institucional, unidades, moradores, convites e portal |
| 3 — Operação administrativa | Documentos, comunicados, ocorrências, solicitações, prestadores e contratos |
| 4 — Financeiro | Receitas, despesas, cobranças, aprovações, conciliação e relatórios |
| 5 — Governança | Assembleias, atas, eleições, mandatos e recursos comunitários |
| 6 — Monetização | Planos, assinaturas, limites e suporte SaaS |
| 7 — Produção | Testes completos, revisão de segurança, observabilidade, backup/restauração e homologação |

O roadmap não é um selo de conclusão. Marque uma etapa como concluída somente depois de validar seus critérios funcionais, de segurança e de qualidade.

## 🧯 Solução de problemas

### O comando <code>bun</code> não é reconhecido

Instale Bun seguindo a [documentação oficial](https://bun.sh/docs/installation), feche e reabra o terminal e execute <code>bun --version</code>.

### A aplicação não conecta ao Supabase

- Confira se copiou <code>.env.example</code> para <code>.env</code>.
- Verifique se URL, project ID e publishable key correspondem ao mesmo projeto.
- Reinicie o servidor de desenvolvimento após alterar variáveis.
- Consulte o console do navegador e os logs do terminal, removendo tokens e dados pessoais antes de compartilhar logs.

### Uma alteração aparece no GitHub, mas não no site

Confirme o commit implantado, o workflow usado e o ambiente/URL acessado. GitHub Pages estático e Cloudflare Workers SSR são caminhos diferentes. Consulte [Implantação](#-implantação).

### Uma migração existe, mas o recurso continua falhando

Verifique se a migração foi revisada e aplicada ao projeto Supabase correto e se políticas, grants, bucket e variáveis necessários foram configurados. O arquivo versionado não altera automaticamente o banco remoto.

### Os testes falham

Execute <code>bun install --frozen-lockfile</code> e depois <code>bun run test</code>. Leia a primeira falha real, confirme as variáveis necessárias e reproduza localmente. Não desative testes nem verificações de segurança apenas para obter um build verde.

### O documento não aparece no formulário ou não abre

Confirme que a versão implantada contém a alteração, abra o formulário correto (cadastro/edição, não somente a lista), atualize com <code>Ctrl + F5</code> e confira o estado da migração e do Storage no ambiente utilizado. Não torne o bucket público como atalho para corrigir erros de permissão.

## 📖 Documentação complementar

- [Escopo completo e requisitos do produto — instrucoes.md](./instrucoes.md)
- [Auditoria técnica e de segurança — SECURITY_AUDIT.md](./SECURITY_AUDIT.md)
- [Exemplo de variáveis de ambiente — .env.example](./.env.example)
- [Configuração Cloudflare Workers — wrangler.jsonc](./wrangler.jsonc)
- [GitHub Actions](https://github.com/DevKove/project-genesis/actions)
- [Repositório MORADA360](https://github.com/DevKove/project-genesis)

## 📄 Licença

A licença do projeto ainda deve ser definida e adicionada explicitamente ao repositório. Até que exista um arquivo de licença, não presuma que o código está licenciado para redistribuição, uso comercial ou contribuição sob termos específicos.

---

<div align="center">

**MORADA360 — tecnologia para uma gestão comunitária mais organizada.**

<sub>Documentação viva: mantenha este README atualizado com o código, os testes e a infraestrutura realmente existentes.</sub>

</div>

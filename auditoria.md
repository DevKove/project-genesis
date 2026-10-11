# PROMPT MESTRE — AUDITORIA, CORREÇÃO E VALIDAÇÃO COMPLETA DE SEGURANÇA DE APLICAÇÃO WEB

## 1. PAPEL E RESPONSABILIDADE TÉCNICA

Atue como um engenheiro de segurança de aplicações sênior, especialista em AppSec, OWASP Top 10, OWASP ASVS, segurança de APIs, autenticação, autorização, proteção de bancos de dados, segurança de infraestrutura web e análise de vulnerabilidades.

Sua missão é executar uma auditoria técnica abrangente no sistema existente, identificar vulnerabilidades, corrigir os problemas encontrados dentro do escopo autorizado, implementar proteções adequadas à arquitetura utilizada e validar as correções mediante testes reproduzíveis.

Não se limite a apresentar recomendações genéricas. Inspecione os arquivos reais do projeto, identifique as causas dos problemas, implemente as correções necessárias e documente os resultados.

**Princípios obrigatórios:**

- Segurança desde a concepção (Security by Design).
- Privilégio mínimo (Least Privilege).
- Defesa em profundidade.
- Validação no servidor como autoridade final.
- Separação entre autenticação e autorização.
- Proteção de dados em trânsito e em repouso.
- Fail-safe defaults.
- Auditoria e rastreabilidade.
- Preservação da integridade dos dados.
- Correções verificáveis e documentadas.

Execute os testes somente em ambientes e recursos para os quais exista autorização.

---

## 2. FASE 1 — RECONHECIMENTO E AUDITORIA INICIAL

Antes de modificar qualquer arquivo, examine a estrutura completa do projeto.

Identifique:

1. Linguagens, frameworks, bibliotecas e versões.
2. Estrutura do frontend e backend.
3. Rotas públicas e privadas.
4. Endpoints de API e funções serverless.
5. Sistema de autenticação e gerenciamento de sessões.
6. Regras de autorização e perfis de usuário.
7. Banco de dados, tabelas, relacionamentos e políticas de acesso.
8. Arquivos de configuração e variáveis de ambiente.
9. Integrações externas e chaves de API.
10. Fluxos de upload e processamento de arquivos.
11. Operações de leitura, inserção, atualização e exclusão.
12. Configurações de CORS, cookies, HTTPS e cabeçalhos HTTP.
13. Dependências diretas e transitivas.
14. Configurações de CI/CD e deploy.
15. Histórico do Git e possíveis exposições de segredos.

Procure também por mecanismos de segurança implementados parcialmente, duplicados, inconsistentes ou presentes apenas no frontend.

Crie um inventário das vulnerabilidades potenciais e classifique cada achado segundo:

- Severidade: crítica, alta, média, baixa ou informativa.
- Probabilidade de exploração.
- Impacto sobre confidencialidade, integridade e disponibilidade.
- Ativos e usuários afetados.
- Evidência técnica.
- Arquivos, funções, rotas ou tabelas envolvidos.
- Correção recomendada.
- Método de validação posterior.

Utilize uma metodologia baseada no OWASP Top 10, OWASP ASVS e, para APIs, OWASP API Security Top 10, considerando as versões aplicáveis.

Não classifique uma vulnerabilidade como confirmada apenas por encontrar uma palavra-chave ou configuração suspeita. Procure evidências no fluxo real de execução.

---

## 3. FASE 2 — SEGREDOS, CHAVES DE API E CONFIGURAÇÕES

### 3.1. Proteção de variáveis de ambiente

Verifique se existem:

- Chaves de API no código-fonte.
- Senhas embutidas em arquivos de configuração.
- Tokens de acesso em componentes frontend.
- Credenciais em arquivos JSON, YAML, JavaScript, TypeScript, PHP ou scripts de automação.
- Arquivos `.env` expostos publicamente.
- Arquivos de backup contendo credenciais.
- Segredos em logs, relatórios, documentação ou artefatos de build.
- Variáveis sensíveis incorporadas ao bundle frontend.

Correções obrigatórias:

1. Remova segredos do código-fonte e utilize o mecanismo de gerenciamento de segredos adequado ao ambiente.
2. Garanta que variáveis privadas sejam acessíveis somente no servidor.
3. Configure regras de `.gitignore` e exclusões de build apropriadas.
4. Verifique se arquivos de ambiente ou backups podem ser acessados por HTTP.
5. Diferencie variáveis públicas de variáveis privadas.
6. Verifique se ferramentas de build expõem variáveis privadas por meio de prefixos públicos ou substituição em tempo de compilação.
7. Preserve somente as configurações públicas que realmente precisam estar disponíveis ao cliente.

Nunca considere um arquivo seguro apenas porque está listado no `.gitignore`: verifique se ele já foi versionado ou publicado.

### 3.2. Histórico do Git

Inspecione o histórico acessível do Git em busca de segredos comprometidos.

Se encontrar credenciais expostas:

- Identifique o tipo de segredo e o período de exposição.
- Priorize a revogação ou rotação da credencial.
- Avalie o alcance da exposição.
- Planeje a remoção do histórico quando necessária.
- Preserve a integridade do repositório e documente o procedimento.
- Considere forks, clones, caches, artefatos e ambientes de deploy.

Não execute reescrita de histórico, force push ou remoção destrutiva de branches sem autorização explícita e um plano de recuperação.

A remoção do histórico, isoladamente, não invalida uma credencial comprometida.

### 3.3. Chaves públicas e privadas do banco de dados

Identifique o provedor e o modelo de acesso ao banco.

Para Supabase, quando utilizado:

- Diferencie chaves públicas de cliente, como a publishable key ou a chave `anon` legada, de chaves administrativas, como `service_role` e secret keys.
- Mantenha as chaves administrativas exclusivamente em ambientes confiáveis do servidor.
- Nunca exponha credenciais privilegiadas no frontend.
- Verifique se as permissões do banco são seguras mesmo quando a chave pública é conhecida.
- Revise as políticas de Row-Level Security e as permissões efetivas das funções e tabelas.

Não substitua automaticamente uma chave por outra sem identificar as dependências existentes e validar a compatibilidade.

---

## 4. FASE 3 — BANCO DE DADOS E CONTROLE DE ACESSO

### 4.1. Row-Level Security (RLS)

Quando o banco oferecer suporte a RLS, audite todas as tabelas e operações que contenham dados protegidos.

Verifique:

- Se a RLS está habilitada nas tabelas expostas por APIs.
- Se as políticas cobrem `SELECT`, `INSERT`, `UPDATE` e `DELETE`, conforme aplicável.
- Se usuários não autenticados podem acessar dados indevidos.
- Se usuários autenticados conseguem acessar registros de outras contas, associações, organizações ou unidades.
- Se filtros de tenant são aplicados de forma consistente.
- Se operações administrativas possuem controles explícitos.
- Se views, funções e procedures respeitam as permissões esperadas.
- Se funções com privilégios elevados executam verificações de autorização adequadas.

Implemente políticas baseadas na identidade autenticada, no vínculo real com o registro e no papel autorizado.

Não utilize identificadores enviados pelo cliente como única prova de autorização.

Não crie políticas permissivas apenas para eliminar erros de acesso.

### 4.2. Controle de acesso a registros e prevenção de IDOR/BOLA

Teste a possibilidade de um usuário modificar identificadores em URLs, parâmetros, corpos de requisição ou cabeçalhos para acessar registros de terceiros.

Verifique especialmente:

- Consultas por ID.
- Downloads de documentos.
- Alterações e exclusões.
- Visualização de perfis.
- Registros financeiros ou administrativos.
- Arquivos privados.
- Recursos vinculados a organizações ou associações.
- Endpoints de exportação e relatórios.

A autorização deve ser verificada no servidor em cada operação protegida.

Aplique autorização por objeto e por função. Considere também o acesso indevido a propriedades específicas de um objeto, conhecido como Broken Object Property Level Authorization.

Não confie em botões ocultos, menus condicionais ou validações exclusivamente no frontend.

### 4.3. Criptografia e proteção de dados sensíveis

Identifique os dados que precisam de proteção adicional.

Verifique:

- Criptografia em trânsito por TLS.
- Criptografia em repouso fornecida pelo banco ou armazenamento.
- Proteção de backups e arquivos exportados.
- Tratamento de documentos e informações pessoais.
- Gerenciamento de chaves criptográficas.
- Rotação e controle de acesso às chaves.
- Exclusão ou retenção de dados conforme requisitos aplicáveis.

Quando a criptografia em nível de aplicação for necessária, utilize algoritmos e bibliotecas reconhecidos, com gerenciamento seguro de chaves.

Não implemente algoritmos criptográficos próprios.

Não armazene chaves junto aos dados criptografados sem uma justificativa técnica adequada.

### 4.4. Senhas e credenciais

Verifique se senhas são armazenadas em texto puro ou com mecanismos inadequados.

Requisitos:

- Nunca armazenar senhas em texto puro.
- Preferir Argon2id, quando compatível com a arquitetura.
- Utilizar scrypt ou bcrypt com parâmetros apropriados quando necessário.
- Se a autenticação for gerenciada por um provedor, verificar as garantias documentadas do provedor em vez de implementar um segundo armazenamento de senhas.
- Não utilizar SHA-256 simples, MD5 ou SHA-1 como substitutos de hashing específico para senhas.
- Evitar logs, respostas de API ou mensagens que exponham senhas.
- Proteger os fluxos de recuperação e redefinição de senha.
- Invalidar tokens de recuperação após o uso e respeitar sua expiração.

Não altere hashes ou credenciais existentes sem uma estratégia de migração segura.

---

## 5. FASE 4 — AUTENTICAÇÃO E SESSÕES

### 5.1. Autenticação no servidor

Verifique se todas as operações protegidas validam a identidade no backend.

Audite:

- Login e logout.
- Renovação de sessão.
- Recuperação de senha.
- Autenticação multifator, se suportada.
- Login por provedores externos.
- Expiração de sessão.
- Revogação de tokens.
- Mudanças de senha.
- Mudanças de privilégios.
- Rotas administrativas.

Nunca considere o usuário autenticado apenas porque o frontend mantém um estado local de login.

Valide tokens conforme o mecanismo utilizado, incluindo assinatura, emissor, audiência, expiração e demais parâmetros pertinentes.

### 5.2. Cookies e gerenciamento de sessão

Inspecione os cookies de sessão e os mecanismos de armazenamento de tokens.

Quando aplicável, configure:

- `Secure`.
- `HttpOnly`.
- `SameSite` adequado ao fluxo.
- `Path` e `Domain` restritivos.
- Expiração coerente.
- Rotação do identificador de sessão após autenticação ou elevação de privilégios.
- Invalidação no logout.
- Proteção contra session fixation.
- Proteção contra roubo e reutilização indevida de tokens.

Não mova indiscriminadamente todos os tokens para cookies nem altere o modelo de autenticação sem avaliar CSRF, arquitetura e compatibilidade.

Evite armazenar credenciais de longa duração em `localStorage` quando houver alternativas mais seguras e adequadas.

### 5.3. Autenticação fraca e força bruta

Analise:

- Senhas fracas.
- Fluxos de login excessivamente permissivos.
- Ausência de limites de tentativas.
- Mensagens que permitem enumerar contas.
- Tokens previsíveis.
- Falta de expiração.
- Recuperação de senha vulnerável.
- Ausência de proteção contra reutilização de tokens.
- Falta de MFA em operações de alto risco, quando aplicável.

Implemente políticas de autenticação compatíveis com o risco e com os requisitos do produto.

### 5.4. Rate limiting e bloqueio de tentativas

Implemente limites no servidor para operações sensíveis, como:

- Login.
- Recuperação de senha.
- Envio de códigos de verificação.
- Cadastro.
- Endpoints de consulta intensiva.
- Operações de envio de mensagens.
- APIs sujeitas a abuso.

Use limites por conta, IP e outros sinais apropriados, considerando NAT, proxies e riscos de bloqueio indevido.

Prefira atrasos progressivos, limitação temporária e mecanismos de mitigação adequados ao contexto, evitando bloqueios permanentes que permitam ataques de negação de serviço contra contas específicas.

Configure armazenamento compartilhado para contadores quando houver múltiplas instâncias do backend.

### 5.5. Proteção contra bots

Avalie CAPTCHA, desafios adaptativos ou soluções antiautomação quando justificadas pelo risco.

A validação do desafio deve ocorrer no servidor.

Verifique validade, expiração, contexto e resposta do provedor.

Não considere a simples inclusão de um widget no frontend uma proteção efetiva.

---

## 6. FASE 5 — VALIDAÇÃO DE ENTRADAS E SEGURANÇA CONTRA INJEÇÃO

### 6.1. Validação frontend e backend

Revise todos os formulários, parâmetros, cabeçalhos, filtros, arquivos e payloads recebidos.

No frontend:

- Forneça feedback imediato.
- Valide tipos, formatos e campos obrigatórios.
- Evite envios duplicados.
- Informe erros de maneira acessível.

No backend:

- Revalide todos os dados recebidos.
- Utilize esquemas de validação explícitos.
- Defina limites de tamanho.
- Restrinja enumerações e valores permitidos.
- Verifique tipos, intervalos e formatos.
- Rejeite campos inesperados quando apropriado.
- Valide a semântica e as relações entre os dados.
- Aplique autorização antes de operações protegidas.

A validação frontend melhora a usabilidade, mas não substitui a validação do servidor.

### 6.2. SQL Injection

Inspecione consultas SQL e acesso a bancos de dados.

Corrija:

- Concatenação insegura de entradas em consultas.
- Construção dinâmica inadequada de filtros.
- Uso incorreto de procedimentos armazenados.
- Identificadores SQL controlados pelo cliente.
- Consultas em relatórios, pesquisas e exportações.
- Operações de autenticação vulneráveis a injeção.

Utilize consultas parametrizadas ou prepared statements.

Quando for necessário montar dinamicamente nomes de colunas, tabelas ou critérios de ordenação, utilize listas de valores permitidos e validação estrita.

Não confie apenas em filtros de caracteres ou expressões regulares para impedir SQL Injection.

### 6.3. XSS e conteúdo enviado por usuários

Inspecione todos os locais onde conteúdo fornecido pelo usuário é renderizado.

Aplique:

- Escape contextual de saída.
- Sanitização por biblioteca confiável quando HTML for permitido.
- APIs de renderização seguras.
- Prevenção de execução de scripts em conteúdo armazenado.
- Revisão de templates e componentes de conteúdo rico.
- Proteção de áreas administrativas que exibem informações submetidas por terceiros.

Evite APIs que interpretam HTML arbitrário sem necessidade.

Não aplique escape indiscriminadamente antes do armazenamento quando o correto for escapar no contexto de saída.

### 6.4. CSRF

Verifique operações que alteram estado utilizando cookies de sessão ou outras credenciais automaticamente enviadas pelo navegador.

Implemente as proteções adequadas à arquitetura:

- Tokens anti-CSRF quando necessários.
- Validação de `Origin` e, quando apropriado, `Referer`.
- Configuração adequada de `SameSite`.
- Separação entre métodos de leitura e operações que alteram estado.
- Proteção de formulários e endpoints sensíveis.

Não considere `SameSite` isoladamente uma solução universal para CSRF.

Se a aplicação utilizar autenticação por bearer token em um cabeçalho não enviado automaticamente pelo navegador, avalie o risco segundo esse modelo real, sem adicionar mecanismos incompatíveis desnecessariamente.

### 6.5. SSRF

Identifique funcionalidades que realizam requisições externas a partir de URLs ou endereços fornecidos pelo usuário.

Avalie importação remota de arquivos, webhooks, integrações, geração de previews e acesso a recursos externos.

Implemente, quando aplicável:

- Allowlist de destinos.
- Restrição de protocolos.
- Bloqueio de endereços privados, loopback e link-local.
- Proteção contra acesso a metadados de nuvem.
- Validação após resolução DNS.
- Tratamento de redirecionamentos.
- Limites de tempo e tamanho de resposta.
- Restrições de saída na rede.

Evite depender exclusivamente de uma validação inicial da URL para impedir SSRF.

---

## 7. FASE 6 — UPLOADS E DOWNLOADS DE ARQUIVOS

Audite todos os pontos de envio, armazenamento, visualização e download de arquivos.

Verifique:

1. Autenticação e autorização para upload.
2. Tamanho máximo permitido.
3. Lista de extensões aceitas.
4. Validação do MIME type.
5. Verificação da assinatura real do arquivo, quando aplicável.
6. Geração de nomes de armazenamento seguros.
7. Prevenção de path traversal.
8. Armazenamento fora de diretórios executáveis.
9. Proteção contra sobrescrita de arquivos.
10. Acesso privado a documentos sensíveis.
11. Autorização individual para downloads.
12. Expiração de URLs assinadas.
13. Varredura antimalware, quando apropriada.
14. Limites de processamento e descompressão.
15. Tratamento seguro de SVG e formatos ativos.
16. Exclusão e retenção controladas.

Não confie apenas na extensão ou no `Content-Type` enviado pelo navegador.

Não permita que um usuário acesse documentos de outra pessoa alterando o nome do arquivo ou seu identificador.

Preserve os formatos legítimos utilizados pelo sistema.

---

## 8. FASE 7 — SEGURANÇA DAS APIs E EXPOSIÇÃO DE INFORMAÇÕES

### 8.1. Minimização de respostas

Inspecione as respostas de todas as APIs.

Retorne somente os campos necessários para cada finalidade.

Remova de respostas públicas ou destinadas a usuários comuns:

- Senhas e hashes.
- Tokens e credenciais.
- Segredos internos.
- Dados pessoais sem necessidade.
- Informações administrativas.
- Campos internos de auditoria.
- Detalhes desnecessários da infraestrutura.
- Mensagens de erro com caminhos internos, consultas ou stack traces.

Aplique controle de acesso também a campos individuais.

Não exponha dados de terceiros em listagens, exportações, relatórios ou endpoints de pesquisa.

### 8.2. Vazamento de informações

Investigue:

- Stack traces em produção.
- Mensagens de erro detalhadas.
- Logs públicos.
- Arquivos de depuração.
- Source maps expostos com informações sensíveis.
- Diretórios de backup acessíveis.
- Metadados desnecessários.
- Endpoints administrativos sem proteção.
- Respostas que revelem a existência de contas ou recursos.

Utilize mensagens públicas genéricas e mantenha detalhes técnicos em logs privados, com acesso controlado e sem registrar segredos.

### 8.3. Tokens e credenciais mal gerenciados

Audite tokens de acesso, refresh tokens, tokens de recuperação e credenciais de integrações.

Verifique:

- Expiração.
- Assinatura e validação.
- Rotação.
- Revogação.
- Escopo e privilégios.
- Armazenamento.
- Exposição em URLs.
- Inclusão em logs.
- Reutilização indevida.
- Vazamento por redirecionamentos ou terceiros.

Utilize tokens de curta duração quando apropriado e refresh tokens com controles de rotação e revogação compatíveis com a arquitetura.

Não classifique automaticamente um token como inseguro apenas pelo seu tamanho: avalie sua finalidade, entropia, ciclo de vida, armazenamento e permissões.

### 8.4. CORS

Inspecione as políticas de Cross-Origin Resource Sharing.

Verifique:

- Origens autorizadas.
- Métodos permitidos.
- Cabeçalhos aceitos.
- Uso de credenciais.
- Respostas a preflight.
- Configurações por ambiente.
- Exposição de endpoints sensíveis.

Evite permitir qualquer origem em APIs que utilizem credenciais.

Não utilize `Access-Control-Allow-Origin: *` junto com credenciais de navegador.

Configure explicitamente as origens necessárias e não trate CORS como substituto da autenticação ou autorização.

### 8.5. Proteção contra abuso de recursos

Verifique limites de paginação, tamanho de payloads, quantidade de registros retornados, frequência de consultas e operações computacionalmente caras.

Aplique limites adequados para evitar abuso, consumo excessivo de recursos e negação de serviço na camada de aplicação.

---

## 9. FASE 8 — CABEÇALHOS HTTP E TRANSPORTE SEGURO

Audite e configure os cabeçalhos de segurança adequados ao ambiente:

- `Content-Security-Policy`.
- `Strict-Transport-Security` (HSTS).
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy`.
- `Permissions-Policy`.
- `frame-ancestors` por CSP ou proteção equivalente contra clickjacking.

Avalie outros cabeçalhos de acordo com a compatibilidade do projeto.

Requisitos:

1. Force HTTPS em produção.
2. Garanta que cookies sensíveis utilizem `Secure`.
3. Configure redirecionamento HTTP para HTTPS no ponto apropriado da infraestrutura.
4. Considere o uso de HSTS após confirmar que o domínio e os subdomínios envolvidos suportam HTTPS.
5. Não habilite HSTS com `includeSubDomains` ou preload sem verificar suas consequências.
6. Evite políticas CSP permissivas sem justificativa.
7. Remova cabeçalhos que exponham desnecessariamente a tecnologia utilizada, quando aplicável.
8. Revise a configuração de proxies e balanceadores para evitar confiança indevida em cabeçalhos encaminhados.

Não aplique cabeçalhos indiscriminadamente sem considerar a arquitetura e os requisitos de funcionamento.

---

## 10. FASE 9 — DEPENDÊNCIAS E CADEIA DE SUPRIMENTOS

Execute uma análise de segurança das dependências do projeto.

Inspecione:

- Dependências diretas.
- Dependências transitivas.
- Pacotes desatualizados.
- Vulnerabilidades conhecidas.
- Pacotes abandonados ou suspeitos.
- Scripts de instalação.
- Arquivos de lock.
- Dependências utilizadas somente em desenvolvimento.
- Imagens de contêiner e componentes de infraestrutura, quando existentes.

Utilize ferramentas compatíveis com a stack, como scanners de dependências, auditorias dos gerenciadores de pacotes e ferramentas SAST/DAST quando disponíveis.

Para cada vulnerabilidade encontrada:

1. Identifique o pacote e a versão afetada.
2. Verifique a aplicabilidade ao projeto.
3. Avalie a severidade e o risco real.
4. Determine uma versão corrigida compatível.
5. Planeje a atualização.
6. Execute testes de regressão.
7. Registre exceções justificadas e temporárias.

Não atualize indiscriminadamente todas as dependências para suas versões mais recentes.

Evite atualizações que quebrem compatibilidade sem uma estratégia de migração.

---

## 11. FASE 10 — BLOQUEIO DURANTE ENVIOS E INTEGRIDADE DAS OPERAÇÕES

Revise formulários e operações assíncronas que possam ser enviadas repetidamente.

Implemente:

- Estado de carregamento visível.
- Desabilitação temporária do botão de submissão quando apropriado.
- Prevenção de cliques repetidos.
- Feedback de sucesso e erro.
- Tratamento de timeout.
- Possibilidade adequada de recuperação.
- Idempotência em operações críticas quando necessária.

O bloqueio visual do botão não substitui controles no servidor.

Implemente proteção contra duplicidade no backend para operações como pagamentos, criação de registros críticos ou outras ações em que requisições repetidas possam causar danos.

Não deixe o formulário permanentemente bloqueado em caso de erro.

Não descarte dados preenchidos pelo usuário sem necessidade.

---

## 12. FASE 11 — TESTES DE SEGURANÇA E VALIDAÇÃO

Depois das correções, execute uma nova rodada de testes.

### Testes obrigatórios

**A. Configuração e segredos**
- Verificar a ausência de segredos no frontend compilado.
- Verificar arquivos sensíveis expostos.
- Verificar o histórico acessível do Git.
- Confirmar a rotação de credenciais comprometidas quando necessária.

**B. Autenticação e autorização**
- Acesso anônimo a rotas protegidas.
- Acesso de um usuário a registros de outro.
- Tentativas de elevar privilégios.
- Tokens expirados ou inválidos.
- Logout e invalidação de sessão.
- Acesso a operações administrativas.

**C. Validação e injeção**
- Payloads malformados.
- SQL Injection em entradas relevantes.
- XSS refletido e armazenado.
- Alteração indevida de campos protegidos.
- Manipulação de identificadores.
- Valores fora dos limites esperados.

**D. Sessões e CSRF**
- Atributos dos cookies.
- Expiração e revogação.
- Requisições cross-site relevantes.
- Proteção de operações que alteram estado.

**E. APIs e infraestrutura**
- Rate limiting.
- CORS.
- Cabeçalhos HTTP.
- Respostas excessivas.
- Mensagens de erro.
- Limites de requisições e payloads.

**F. Arquivos**
- Extensões não permitidas.
- MIME type incompatível.
- Arquivos acima do limite.
- Nomes maliciosos.
- Tentativas de acesso a arquivos de terceiros.
- Downloads sem autorização.

**G. Dependências**
- Nova execução dos scanners.
- Revisão das vulnerabilidades corrigidas.
- Verificação de regressões.

Utilize dados de teste e contas controladas. Não execute testes destrutivos contra dados reais de produção.

---

## 13. FASE 12 — CRITÉRIOS DE ACEITAÇÃO

O trabalho será considerado concluído somente após verificar os seguintes pontos:

- [ ] Segredos removidos do código e de artefatos públicos.
- [ ] Credenciais expostas rotacionadas quando necessário.
- [ ] Histórico do Git analisado e plano de remediação documentado.
- [ ] Chaves públicas e privadas corretamente separadas.
- [ ] RLS e permissões de banco verificadas.
- [ ] Autorização por registro validada no servidor.
- [ ] Dados sensíveis adequadamente protegidos.
- [ ] Senhas tratadas com mecanismos seguros.
- [ ] Autenticação e sessões revisadas.
- [ ] Proteção contra força bruta e abuso implementada.
- [ ] Validação frontend e backend revisada.
- [ ] Consultas parametrizadas verificadas.
- [ ] Proteções contra XSS e CSRF avaliadas.
- [ ] Proteção contra SSRF aplicada quando pertinente.
- [ ] Uploads e downloads protegidos.
- [ ] Respostas das APIs minimizadas.
- [ ] CORS e cabeçalhos HTTP revisados.
- [ ] HTTPS e cookies configurados adequadamente.
- [ ] Rate limiting implementado onde necessário.
- [ ] Dependências analisadas e vulnerabilidades tratadas.
- [ ] Submissões duplicadas e operações críticas protegidas.
- [ ] Testes de regressão executados.
- [ ] Build, lint e verificações de tipos executados quando disponíveis.
- [ ] Vulnerabilidades residuais documentadas.

Não marque nenhum item como aprovado sem evidência suficiente.

Quando uma proteção não for pertinente à arquitetura, registre a justificativa técnica.

Quando não for possível testar algo, classifique como não verificado, em vez de aprovado.

---

## 14. CONTROLE DE MUDANÇAS E PRESERVAÇÃO DO SISTEMA

Antes de modificar arquivos, verifique o estado atual do repositório.

Regras obrigatórias:

1. Não apague arquivos ou dados sem autorização.
2. Não sobrescreva mudanças preexistentes do usuário.
3. Não altere credenciais, permissões, políticas ou dados de produção de forma destrutiva.
4. Não remova mecanismos de segurança para fazer testes passarem.
5. Não desabilite RLS como solução para problemas de acesso.
6. Não exponha segredos em relatórios ou mensagens.
7. Não execute force push ou reescrita de histórico sem autorização.
8. Preserve as funcionalidades existentes.
9. Faça alterações incrementais e reversíveis sempre que possível.
10. Mantenha registro dos arquivos alterados e das justificativas técnicas.

Se o sistema utilizar Supabase, examine primeiro o projeto correto, as políticas existentes, as tabelas envolvidas e as permissões efetivas. Não modifique projetos, bancos ou recursos diferentes daqueles autorizados.

Se houver uma vulnerabilidade crítica que exija intervenção imediata, apresente o risco, a medida recomendada e os impactos antes de realizar uma alteração destrutiva ou irreversível.

---

## 15. RELATÓRIO FINAL OBRIGATÓRIO

Ao terminar, produza um relatório técnico organizado com:

### A. Resumo executivo
Descreva os riscos mais relevantes e a situação geral da aplicação.

### B. Inventário de vulnerabilidades
Para cada achado, informe:
- Identificador.
- Descrição.
- Severidade.
- Evidência.
- Arquivos, rotas ou tabelas afetados.
- Impacto.
- Correção aplicada ou recomendada.
- Resultado do reteste.

### C. Arquivos modificados
Liste os arquivos alterados e a finalidade de cada alteração.

### D. Correções implementadas
Explique as medidas efetivamente aplicadas.

### E. Testes realizados
Informe os comandos, ferramentas, cenários e resultados obtidos.

### F. Pendências
Relacione as vulnerabilidades não corrigidas, limitações ambientais, testes não executados e riscos residuais.

### G. Situação por critério
Classifique cada item como:
- **Corrigido e validado:** correção aplicada e teste satisfatório.
- **Corrigido, mas não validado:** alteração realizada sem reteste suficiente.
- **Pendente:** requer ação adicional.
- **Não aplicável:** acompanhado de justificativa técnica.
- **Não verificado:** ausência de evidência suficiente.

### H. Próximos passos
Priorize as ações restantes por severidade e impacto.

Não declare que o sistema está totalmente seguro, invulnerável ou aprovado em auditoria formal apenas porque os testes executados passaram.

Diferencie claramente uma revisão automatizada, uma análise manual, testes de exploração controlada e uma auditoria profissional independente.

---

## 16. INSTRUÇÃO FINAL

Inicie imediatamente pela auditoria da arquitetura e dos arquivos existentes.

Depois, implemente as correções autorizadas por ordem de prioridade, valide cada alteração e prossiga até concluir o escopo possível.

Não pare após gerar uma lista de recomendações.

Não invente arquivos, resultados, evidências ou vulnerabilidades.

Não declare testes executados que não foram realmente executados.

Preserve o funcionamento do sistema, os dados existentes, a autenticação, as permissões e as integrações.

**Objetivo final: reduzir de forma comprovável a superfície de ataque da aplicação, corrigir vulnerabilidades identificadas e entregar um relatório técnico transparente, reproduzível e verificável.**
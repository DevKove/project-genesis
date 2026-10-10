# PROJETO: MORADA360 — PLATAFORMA SaaS COMPLETA PARA GESTÃO DE ASSOCIAÇÕES DE MORADORES

## 1. PAPEL E OBJETIVO DO DESENVOLVIMENTO

Atue como uma equipe multidisciplinar de alto nível, composta por arquiteto de software, engenheiro de segurança, desenvolvedor full-stack sênior, especialista em SaaS multi-tenant, UX/UI designer, analista financeiro, especialista em LGPD, QA engineer e engenheiro de infraestrutura.

Desenvolva uma plataforma SaaS profissional, completa, modular, segura, escalável e comercializável para a administração de associações de moradores, bairros organizados, loteamentos, comunidades residenciais e entidades associativas.

O sistema deverá permitir que múltiplas associações utilizem a mesma plataforma, mantendo seus ambientes administrativos, usuários, documentos, moradores, prestadores, movimentações financeiras e demais registros rigorosamente separados.

O projeto terá como nome provisório MORADA360, com arquitetura preparada para futura alteração de marca, logotipo, domínio, identidade visual e planos comerciais.

ATENÇÃO: não desenvolva apenas um protótipo visual, landing page ou painel demonstrativo. Construa um sistema funcional, com banco de dados real, autenticação segura, autorização no backend, operações CRUD completas, validações, auditoria, relatórios, testes automatizados e integração entre os módulos.

Todo botão, formulário, filtro, menu, gráfico, indicador, relatório e ação deverá possuir comportamento funcional. Não utilize dados fictícios como se fossem informações reais em produção.

---

## 2. ARQUITETURA GERAL DO SAAS

O sistema deverá possuir uma arquitetura multi-tenant.

A plataforma terá três níveis principais:

### Nível 1 — Administração central do SaaS

Responsável pelo proprietário da plataforma e sua equipe autorizada.

Poderá administrar:
- Todas as associações cadastradas.
- Planos, assinaturas e limites de utilização.
- Usuários administrativos globais.
- Pagamentos e inadimplência das assinaturas SaaS.
- Configurações globais.
- Módulos disponíveis por plano.
- Consumo de armazenamento e recursos.
- Logs técnicos e auditoria administrativa.
- Solicitações de suporte.
- Suspensão e reativação de ambientes conforme regras contratuais.
- Indicadores gerais da operação.
- Versões, manutenção e notificações globais.

### Nível 2 — Administração de cada associação

Cada associação terá seu próprio ambiente administrativo.

O administrador poderá:
- Criar e configurar a associação.
- Cadastrar moradores, proprietários, dependentes e ocupantes.
- Criar unidades residenciais, lotes, quadras, ruas e setores.
- Cadastrar funcionários e prestadores.
- Administrar cobranças, despesas, receitas e orçamento.
- Registrar ocorrências e solicitações.
- Gerenciar documentos, atas, assembleias e eleições.
- Criar outros usuários administrativos com permissões específicas.
- Personalizar identidade visual e regras internas.
- Consultar relatórios e indicadores.
- Configurar notificações e canais de atendimento.
- Administrar os módulos contratados e as permissões internas.

### Nível 3 — Usuários da associação

Cada associação poderá disponibilizar acessos específicos para:
- Presidente.
- Vice-presidente.
- Diretor financeiro.
- Diretor administrativo.
- Secretário.
- Conselheiros.
- Tesoureiro.
- Funcionários.
- Moradores.
- Proprietários.
- Inquilinos.
- Dependentes autorizados.
- Prestadores de serviços.
- Auditores e usuários de consulta.
- Portaria, quando o módulo estiver habilitado.

Os perfis serão configuráveis. Não presuma que todo usuário terá acesso a todos os módulos.

---

## 3. MULTI-TENANCY E ISOLAMENTO DE DADOS

Implemente isolamento rigoroso entre associações.

Cada associação deverá possuir um identificador interno imutável, denominado tenant_id ou equivalente.

Todos os registros pertencentes a uma associação deverão estar vinculados ao respectivo tenant, inclusive:
- Usuários e vínculos.
- Moradores e unidades.
- Lançamentos financeiros.
- Documentos e arquivos.
- Prestadores e contratos.
- Ocorrências.
- Solicitações.
- Assembleias.
- Atas e votações.
- Notificações.
- Relatórios.
- Registros de auditoria.
- Configurações específicas.
- Integrações externas.

Requisitos obrigatórios:
- Aplicar autorização e escopo do tenant no backend.
- Nunca confiar no tenant_id enviado livremente pelo navegador.
- Resolver o tenant a partir da sessão autenticada e do vínculo autorizado.
- Validar o tenant em cada operação de leitura e escrita.
- Implementar políticas de acesso no banco de dados quando suportadas.
- Utilizar chaves estrangeiras e restrições para impedir vínculos entre associações distintas.
- Isolar arquivos, exportações, relatórios, pesquisas e tarefas em segundo plano.
- Impedir acesso por alteração manual de IDs nas URLs ou requisições.
- Realizar testes automatizados de tentativa de acesso cruzado.
- Criar trilhas de auditoria para operações administrativas críticas.

Uma associação jamais poderá visualizar, alterar, excluir ou exportar informações de outra associação sem autorização global expressa, controlada e auditada.

---

## 4. CADASTRO E CONFIGURAÇÃO DA ASSOCIAÇÃO

Criar um assistente de implantação inicial, com etapas orientadas.

### Dados institucionais
- Razão social ou denominação oficial.
- Nome fantasia.
- CNPJ, quando aplicável.
- Data de fundação.
- Endereço completo.
- Município e UF.
- CEP.
- Telefone institucional.
- E-mail oficial.
- Site e redes sociais.
- Logotipo.
- Brasão ou símbolo institucional.
- Descrição da associação.
- Estatuto social.
- Regulamento interno.
- Documentos constitutivos.
- Dados dos representantes legais.
- Vigência do mandato administrativo.

### Estrutura territorial
Permitir cadastrar:
- Bairros.
- Setores.
- Quadras.
- Ruas.
- Lotes.
- Unidades residenciais.
- Unidades comerciais, quando aplicável.
- Áreas comuns.
- Equipamentos comunitários.
- Identificadores personalizados.

Cada unidade deverá ter histórico de ocupação, responsáveis vinculados, situação cadastral e registros associados.

### Configurações administrativas
- Moeda e formatação monetária.
- Fuso horário.
- Calendário de vencimentos.
- Política de notificações.
- Categorias financeiras.
- Modelos de documentos.
- Perfis de acesso.
- Regras de cobrança.
- Regras de aprovação.
- Módulos ativos.
- Configurações de privacidade.
- Logotipo e cores da associação.

O assistente deverá permitir salvar parcialmente e continuar a configuração posteriormente.

---

## 5. SISTEMA DE USUÁRIOS, PERFIS E PERMISSÕES

Implementar controle de acesso baseado em funções e permissões, com RBAC e escopo por associação.

Criar uma matriz de permissões configurável, com operações:
- Visualizar.
- Criar.
- Editar.
- Excluir.
- Aprovar.
- Rejeitar.
- Exportar.
- Imprimir.
- Gerenciar configurações.
- Administrar permissões.
- Consultar dados sensíveis.
- Realizar operações financeiras.
- Visualizar auditoria.

### Perfis predefinidos

**Superadministrador SaaS**
Acesso global à administração técnica e comercial da plataforma, com privilégios controlados e auditados.

**Administrador da associação**
Gerencia o ambiente da associação, cria usuários, define permissões e configura módulos, sem acesso aos ambientes de outras associações.

**Presidente**
Acompanha a gestão, aprova operações previstas nas regras internas, consulta indicadores e administra assuntos institucionais autorizados.

**Vice-presidente**
Possui permissões delegadas, com possibilidade de substituição temporária conforme regras configuradas.

**Diretor financeiro**
Gerencia receitas, despesas, cobranças, conciliações, orçamento e relatórios financeiros, sem acesso automático a dados pessoais desnecessários.

**Tesoureiro**
Executa operações financeiras autorizadas e apresenta prestações de contas.

**Secretário**
Gerencia documentos, atas, assembleias, correspondências e registros institucionais.

**Conselheiro fiscal**
Consulta documentos, lançamentos, comprovantes e relatórios necessários à fiscalização, preferencialmente em modo somente leitura.

**Funcionário administrativo**
Acessa apenas os módulos e registros necessários às suas atividades.

**Morador**
Consulta informações autorizadas, boletos, demonstrativos disponibilizados, comunicados, documentos públicos da associação, ocorrências próprias e solicitações.

**Proprietário**
Gerencia dados de sua unidade e os vínculos autorizados, sem acesso irrestrito aos dados privados de outros ocupantes.

**Inquilino**
Acessa funcionalidades autorizadas pela associação e pelo vínculo cadastral.

**Dependente**
Possui acesso limitado, definido pelo responsável e pelas regras da associação.

**Prestador**
Consulta apenas serviços, ordens de trabalho, documentos e informações necessárias à sua atuação.

**Auditor**
Acesso de consulta limitado ao escopo aprovado, com registro de consultas e exportações sensíveis.

**Portaria**
Quando habilitada, consulta os dados estritamente necessários para as atividades de controle de acesso, sem visualizar informações financeiras ou administrativas desnecessárias.

Permitir criação de perfis personalizados, permissões individuais excepcionais, revogação imediata de acessos e atribuição de mais de uma função ao mesmo usuário.

Implementar:
- Convites por e-mail.
- Ativação de conta.
- Recuperação segura de senha.
- MFA opcional ou obrigatório conforme perfil e política.
- Autenticação por aplicativo autenticador compatível com TOTP.
- Sessões revogáveis.
- Histórico de acessos.
- Bloqueio progressivo contra tentativas abusivas.
- Encerramento de sessões.
- Verificação de e-mail.
- Gestão de dispositivos, quando suportada.
- Fluxo de primeiro acesso.
- Desativação de usuários sem excluir o histórico de auditoria.

O sistema deverá autorizar todas as operações no servidor. Ocultar menus na interface não será considerado controle de segurança suficiente.

---

## 6. CADASTRO COMPLETO DE MORADORES

Criar um módulo completo de moradores.

### Dados pessoais
- Nome completo.
- Nome social, quando informado.
- CPF, quando necessário e autorizado.
- RG ou outro documento, quando necessário.
- Data de nascimento, quando necessária.
- E-mail.
- Telefone.
- Endereço.
- Fotografia opcional.
- Contato de emergência, quando justificado.
- Preferência de comunicação.
- Situação cadastral.
- Data de cadastro.
- Documentos anexados conforme finalidade.

### Vínculo residencial
- Unidade, lote, quadra e setor.
- Proprietário, inquilino, ocupante ou dependente.
- Data de entrada.
- Data de saída.
- Responsável pela unidade.
- Quantidade de ocupantes, quando necessária.
- Veículos vinculados, se o módulo estiver habilitado.
- Animais domésticos, quando necessário e justificável.
- Autorizações específicas.
- Histórico de alterações.

### Funcionalidades
- Cadastro individual e em lote.
- Importação por CSV e planilha validada.
- Detecção de duplicidades.
- Pesquisa por nome, unidade ou situação.
- Filtros avançados.
- Histórico cadastral.
- Transferência entre unidades.
- Gestão de mudança de proprietário.
- Gestão de locação e encerramento de vínculo.
- Emissão de declaração de residência, quando autorizada.
- Geração de relatórios.
- Exportação conforme permissões.
- Registro de consentimentos quando aplicável.
- Atendimento de solicitações de correção de dados.
- Arquivamento lógico e política de retenção.

Nunca exiba CPF completo, documentos ou contatos privados em telas públicas ou relatórios não autorizados.

---

## 7. PORTAL DO MORADOR

Criar uma área exclusiva, responsiva e intuitiva para os moradores.

O morador poderá:
- Visualizar e atualizar informações permitidas.
- Solicitar correções cadastrais.
- Consultar suas unidades vinculadas.
- Visualizar cobranças e demonstrativos autorizados.
- Baixar documentos disponibilizados.
- Consultar comunicados.
- Abrir solicitações administrativas.
- Registrar ocorrências.
- Acompanhar protocolos.
- Consultar o andamento de serviços.
- Participar de assembleias digitais quando habilitadas.
- Registrar presença em reuniões.
- Participar de votações autorizadas.
- Consultar atas publicadas.
- Receber notificações.
- Consultar calendário de eventos.
- Enviar sugestões e reclamações.
- Consultar regras e regulamentos.
- Avaliar serviços quando permitido.
- Consultar histórico das próprias solicitações.

A interface não deverá permitir que um morador visualize registros particulares de outros moradores.

---

## 8. GESTÃO FINANCEIRA COMPLETA

Criar um módulo financeiro robusto, com separação entre o financeiro da associação e o financeiro comercial do SaaS.

### Contas a receber
- Mensalidades associativas.
- Contribuições ordinárias e extraordinárias.
- Taxas aprovadas conforme regras aplicáveis.
- Cobranças por serviços.
- Receitas eventuais.
- Receitas de locação de espaços.
- Multas e juros, quando legalmente aplicáveis.
- Descontos e abatimentos autorizados.
- Acordos de pagamento.
- Parcelamentos.
- Isenções formalmente autorizadas.
- Créditos e ajustes.

Cada cobrança deverá ter unidade, responsável, competência, vencimento, valor, status, origem e histórico.

### Contas a pagar
- Fornecedores.
- Prestadores.
- Folha de pagamento, se aplicável.
- Água, energia e telecomunicações.
- Manutenção.
- Materiais.
- Serviços contratados.
- Tributos e obrigações.
- Seguros.
- Despesas administrativas.
- Reembolsos.
- Despesas extraordinárias.

### Gestão financeira avançada
- Plano de contas.
- Centros de custo.
- Categorias de receitas e despesas.
- Contas bancárias.
- Caixa.
- Fluxo de caixa.
- Competência e regime de caixa.
- Conciliação bancária.
- Lançamentos recorrentes.
- Projeções financeiras.
- Orçamento anual.
- Comparativo orçado versus realizado.
- Gestão de fundos e reservas.
- Rateio de despesas quando autorizado.
- Demonstrativos mensais.
- Prestação de contas.
- Comprovantes anexos.
- Fechamento mensal.
- Reabertura mediante permissão e justificativa.
- Controle de inadimplência.
- Aging de recebíveis.
- Histórico de renegociações.
- Relatórios por período, categoria e unidade.

### Aprovações financeiras

Implementar fluxos configuráveis:
1. Lançamento.
2. Conferência documental.
3. Aprovação.
4. Pagamento ou recebimento.
5. Conciliação.
6. Fechamento.

Permitir limites de alçada, dupla aprovação e segregação de funções. O usuário que cadastrar uma despesa não deverá obrigatoriamente ser quem a aprova.

Não permitir exclusão silenciosa de lançamentos confirmados. Correções deverão ocorrer por estorno, reversão ou ajuste auditado.

### Integrações financeiras
Preparar arquitetura para:
- Pix por provedores autorizados.
- Boletos.
- Links de pagamento.
- Webhooks de confirmação.
- Extratos bancários.
- Arquivos CNAB quando suportados.
- Emissão de documentos financeiros.
- Integração contábil.

Não simular pagamentos reais. Implementar idempotência, validação de assinatura dos webhooks, reconciliação e tratamento de falhas.

Não armazenar credenciais bancárias ou dados sensíveis de pagamento em texto puro.

### Relatórios financeiros
- Demonstrativo de receitas e despesas.
- Fluxo de caixa.
- Inadimplência.
- Contas vencidas.
- Contas a pagar.
- Receitas por competência.
- Despesas por categoria.
- Orçamento versus realizado.
- Evolução mensal.
- Prestação de contas por período.
- Demonstrativo de fundos.
- Relatório de conciliação.
- Exportação PDF e XLSX.

---

## 9. PRESTADORES DE SERVIÇOS E FORNECEDORES

Criar cadastro centralizado de prestadores e empresas.

Dados:
- Razão social ou nome.
- Nome fantasia.
- CNPJ ou CPF, conforme necessário.
- Responsável.
- Telefone e e-mail.
- Endereço.
- Especialidades.
- Dados contratuais.
- Documentação.
- Certidões, quando necessárias.
- Seguros e licenças aplicáveis.
- Dados de pagamento com acesso restrito.
- Situação cadastral.
- Avaliações autorizadas.
- Histórico de serviços.

Funcionalidades:
- Cadastro de fornecedores.
- Solicitação de orçamento.
- Comparação de propostas.
- Aprovação de contratação.
- Gestão de contratos.
- Alertas de vencimento.
- Ordens de serviço.
- Controle de execução.
- Registro de visitas.
- Anexos antes e depois.
- Aprovação do serviço.
- Registro de garantias.
- Histórico de ocorrências.
- Controle de pagamentos.
- Avaliação de desempenho.

Permitir que um prestador tenha acesso externo restrito apenas aos serviços atribuídos a ele.

---

## 10. MANUTENÇÃO, PATRIMÔNIO E ÁREAS COMUNS

Implementar:
- Cadastro de bens e patrimônio.
- Identificação patrimonial.
- Localização.
- Aquisição e valor.
- Estado de conservação.
- Garantias.
- Histórico de manutenção.
- Inventário.
- Termos de responsabilidade.
- Transferências patrimoniais.
- Baixa e justificativa.
- Fotografias e documentos.

### Áreas comuns
- Praças.
- Salões.
- Quadras.
- Parques.
- Equipamentos comunitários.
- Espaços para eventos.
- Outras instalações.

Funcionalidades:
- Calendário de utilização.
- Reservas.
- Regras de uso.
- Capacidade máxima.
- Aprovação de reservas.
- Taxas aplicáveis.
- Termos de responsabilidade.
- Vistorias.
- Registro de danos.
- Bloqueio para manutenção.
- Histórico de utilização.

Evitar conflitos de reservas com transações consistentes e validação no backend.

---

## 11. OCORRÊNCIAS, RECLAMAÇÕES E SOLICITAÇÕES

Criar sistema completo de protocolos.

Categorias configuráveis:
- Manutenção.
- Iluminação.
- Limpeza.
- Barulho.
- Segurança comunitária.
- Infraestrutura.
- Animais.
- Descarte irregular.
- Convivência.
- Reclamações administrativas.
- Sugestões.
- Outros.

Cada protocolo deverá possuir:
- Número sequencial por associação.
- Data e hora.
- Solicitante.
- Unidade vinculada, quando aplicável.
- Categoria.
- Descrição.
- Prioridade.
- Responsável.
- Anexos.
- Comentários.
- Histórico de movimentações.
- Prazo de atendimento.
- Status.
- Data de conclusão.
- Avaliação, quando habilitada.

Fluxo sugerido:
Aberto → Triagem → Em atendimento → Aguardando informações → Resolvido → Encerrado.

Permitir reabertura autorizada, encaminhamento, atribuição, prazos, alertas de atraso e relatórios.

Ocorrências envolvendo dados sensíveis ou acusações pessoais deverão ter acesso restrito, evitando exposição pública e divulgação indevida.

---

## 12. GESTÃO DOCUMENTAL E ARQUIVOS

Criar repositório documental organizado por associação.

Categorias:
- Estatuto.
- Regulamento interno.
- Atas.
- Editais.
- Contratos.
- Notas fiscais.
- Comprovantes.
- Documentos administrativos.
- Documentos financeiros.
- Relatórios.
- Certidões.
- Correspondências.
- Documentos de moradores.
- Documentos de prestadores.

Recursos:
- Pastas e categorias.
- Metadados.
- Busca textual.
- Controle de versões.
- Permissões por documento.
- Pré-visualização segura.
- Download autorizado.
- Data de emissão.
- Validade.
- Alertas de vencimento.
- Histórico de acesso.
- Registro de aprovação.
- Modelos de documentos.
- Geração de PDFs.
- Assinaturas eletrônicas por integração apropriada.

Implementar validação de arquivos, limites de tamanho, proteção contra arquivos maliciosos e URLs temporárias de acesso.

Documentos privados nunca poderão ser disponibilizados por URLs públicas permanentes.

---

## 13. ASSEMBLEIAS, ATAS, ELEIÇÕES E GOVERNANÇA

Criar módulo de governança institucional.

### Assembleias
- Cadastro de assembleias ordinárias e extraordinárias.
- Data, hora e local.
- Modalidade presencial, virtual ou híbrida.
- Editais de convocação.
- Pauta.
- Lista de presença.
- Documentos anexos.
- Registro de deliberações.
- Ata.
- Aprovação da ata.
- Histórico de participantes.
- Publicação para os públicos autorizados.

### Votações
- Criação de pautas.
- Regras de elegibilidade.
- Identificação de eleitores autorizados.
- Prazo de votação.
- Voto único quando aplicável.
- Apuração.
- Registro de resultados.
- Relatórios.
- Auditoria do processo.

O sistema deverá respeitar o estatuto e as regras legalmente aplicáveis. Não presumir automaticamente que toda unidade tem direito a voto, nem implementar anonimato ou sigilo eleitoral sem definir corretamente as regras.

### Mandatos e conselhos
- Cadastro de cargos.
- Mandatos.
- Datas de início e fim.
- Histórico de gestões.
- Composição dos conselhos.
- Responsabilidades.
- Alertas de vencimento.
- Transição entre diretorias.
- Termos de posse.
- Relatórios de gestão.

---

## 14. COMUNICAÇÃO E NOTIFICAÇÕES

Implementar central de comunicação por associação.

Funcionalidades:
- Comunicados gerais.
- Comunicados segmentados.
- Avisos por setor ou unidade.
- Mensagens administrativas.
- Notificações de cobranças.
- Lembretes de vencimento.
- Alertas de manutenção.
- Convocações.
- Avisos de assembleia.
- Atualizações de protocolos.
- Notificações de documentos.
- Calendário de eventos.
- Preferências de comunicação.
- Histórico de envio.
- Registro de falhas.

Canais preparados para:
- Notificações internas.
- E-mail.
- Push web ou aplicativo.
- WhatsApp Business por integração oficial, quando contratada.

Implementar filas de processamento, tentativas controladas, limites de envio e logs.

Não afirmar que uma mensagem foi entregue quando o provedor não confirmar o resultado.

---

## 15. FUNCIONÁRIOS E RECURSOS HUMANOS

Quando aplicável, incluir:
- Cadastro de funcionários.
- Cargo e departamento.
- Vínculo contratual.
- Data de admissão.
- Documentos autorizados.
- Escalas de trabalho.
- Registro de férias e afastamentos.
- Controle de uniformes e equipamentos.
- Entrega de materiais.
- Termos de responsabilidade.
- Histórico de atividades.
- Controle de acesso administrativo.

Dados trabalhistas e pessoais deverão ter acesso restrito. Não substituir sistemas oficiais de folha, eSocial ou contabilidade sem integrações específicas e validação profissional.

---

## 16. CONTROLE DE ACESSO E PORTARIA — MÓDULO OPCIONAL

Preparar módulo habilitável por associação, caso sua realidade operacional exija portaria.

Funcionalidades possíveis:
- Cadastro autorizado de visitantes.
- Pré-autorização de entrada.
- Identificação da unidade de destino.
- Registro de entrada e saída.
- Registro de prestadores.
- Agenda de serviços.
- Entregas.
- Registro de ocorrências na portaria.
- Consulta restrita de unidades.
- Histórico de movimentações.
- Credenciais temporárias.
- Relatórios operacionais.

Não implementar reconhecimento facial, biometria ou monitoramento invasivo por padrão. Qualquer recurso dessa natureza deverá passar por análise específica de necessidade, segurança e conformidade legal.

---

## 17. DASHBOARD E INDICADORES

Criar painéis diferentes conforme o perfil autenticado.

### Dashboard do administrador SaaS
- Associações cadastradas.
- Associações ativas.
- Assinaturas por plano.
- Receita recorrente mensal.
- Receita recorrente anualizada.
- Cancelamentos.
- Inadimplência SaaS.
- Crescimento da base.
- Utilização de recursos.
- Falhas de processamento.
- Chamados de suporte.
- Alertas de infraestrutura.

### Dashboard da associação
- Total de unidades.
- Moradores ativos.
- Novos cadastros.
- Solicitações abertas.
- Protocolos atrasados.
- Contratos a vencer.
- Receitas do mês.
- Despesas do mês.
- Saldo por conta.
- Inadimplência.
- Contas a pagar.
- Orçamento utilizado.
- Próximas assembleias.
- Próximos eventos.
- Documentos vencendo.
- Pendências de aprovação.

### Dashboard do morador
- Resumo de cobranças próprias.
- Protocolos em andamento.
- Comunicados recentes.
- Próximos eventos.
- Documentos disponíveis.
- Reservas.
- Solicitações pendentes.

Os indicadores devem utilizar dados reais, períodos claramente identificados, cálculos consistentes e autorização correspondente ao perfil.

---

## 18. RELATÓRIOS E EXPORTAÇÕES

Criar central de relatórios com filtros e exportações.

Formatos:
- PDF.
- XLSX.
- CSV.
- Impressão otimizada.

Relatórios:
- Moradores.
- Unidades.
- Proprietários e ocupantes.
- Prestadores.
- Contratos.
- Serviços.
- Ocorrências.
- Protocolos.
- Patrimônio.
- Receitas e despesas.
- Inadimplência.
- Prestação de contas.
- Assembleias.
- Presenças.
- Votações.
- Documentos.
- Auditoria.
- Indicadores de atendimento.

Permitir selecionar colunas, período, situação, categorias e agrupamentos.

Restringir exportações de dados pessoais e financeiros a usuários autorizados. Aplicar limites, registrar exportações sensíveis e evitar exposição de informações desnecessárias.

---

## 19. ASSINATURAS E MONETIZAÇÃO DO SAAS

Criar um módulo comercial próprio para monetização da plataforma.

### Planos sugeridos

**Essencial**
- Cadastro da associação.
- Gestão básica de moradores.
- Comunicados.
- Solicitações.
- Documentos.
- Relatórios essenciais.

**Profissional**
- Todos os recursos essenciais.
- Gestão financeira.
- Prestadores.
- Contratos.
- Assembleias.
- Aprovações.
- Relatórios avançados.

**Premium**
- Todos os recursos profissionais.
- Integrações financeiras.
- Automações.
- Módulo opcional de portaria.
- Personalização avançada.
- Permissões avançadas.
- Relatórios adicionais.
- Recursos prioritários de suporte.

**Enterprise**
- Condições comerciais personalizadas.
- Limites ampliados.
- Integrações específicas.
- Políticas administrativas adicionais.
- Suporte contratado conforme SLA.
- Recursos exclusivos previstos no contrato.

Os nomes, preços, limites e funcionalidades devem ser configuráveis pelo administrador SaaS.

### Gestão comercial
- Assinatura mensal e anual.
- Período de avaliação.
- Cupons.
- Descontos.
- Renovação.
- Cancelamento.
- Histórico de cobranças.
- Reembolsos quando aplicáveis.
- Mudança de plano.
- Controle de usuários e armazenamento.
- Período de tolerância por inadimplência.
- Suspensão e reativação conforme política publicada.
- Faturas e recibos.
- Webhooks de pagamento.
- Histórico contratual.

Separar rigorosamente as cobranças do SaaS das receitas e despesas das associações.

O sistema não deverá bloquear acesso a documentos essenciais ou impedir exportação de dados próprios de maneira arbitrária. Implementar processo de encerramento, portabilidade e retenção compatível com a legislação e o contrato.

---

## 20. SUPORTE E ATENDIMENTO

Criar central de suporte com:
- Abertura de chamados.
- Categorias.
- Prioridades.
- Anexos.
- Responsáveis.
- Histórico.
- Comentários.
- Status.
- SLA configurável.
- Base de conhecimento.
- Perguntas frequentes.
- Notificações.
- Pesquisa de satisfação.

Separar suporte técnico da plataforma de solicitações internas da associação.

O acesso de suporte aos dados dos clientes deverá ser excepcional, limitado, justificado, autorizado conforme política e integralmente auditado.

---

## 21. SEGURANÇA DA INFORMAÇÃO

Aplicar boas práticas atuais de segurança.

Obrigatório:
- Autenticação segura.
- Hash de senha com algoritmo apropriado, como Argon2id ou bcrypt configurado adequadamente.
- Proteção contra SQL injection.
- Proteção contra XSS.
- Proteção contra CSRF conforme arquitetura.
- Validação de entrada no servidor.
- Controle de sessão.
- Rate limiting.
- Proteção contra enumeração de contas.
- Controle de acesso por objeto.
- Políticas de senha.
- MFA configurável.
- Gestão segura de segredos.
- HTTPS em produção.
- Cookies seguros.
- Cabeçalhos de segurança.
- Logs sem senhas, tokens ou dados sensíveis desnecessários.
- Proteção de arquivos.
- Backups automatizados.
- Testes de restauração.
- Monitoramento de falhas.
- Gestão de dependências.
- Atualizações de segurança.
- Auditoria de ações críticas.
- Rotação de credenciais.
- Procedimentos de resposta a incidentes.

Nunca confiar apenas em validações do frontend.

Não inserir chaves privadas, tokens, senhas, credenciais de pagamento ou segredos de produção no repositório.

Preparar ambientes separados de desenvolvimento, testes e produção.

---

## 22. LGPD E PRIVACIDADE

Implementar recursos para apoiar o cumprimento da Lei Geral de Proteção de Dados Pessoais.

Incluir:
- Inventário de categorias de dados.
- Definição de finalidade.
- Controle de acesso.
- Registro de solicitações dos titulares.
- Correção de dados.
- Exportação de dados pessoais quando cabível.
- Anonimização ou exclusão quando legalmente aplicável.
- Gestão de consentimentos quando essa for a base adequada.
- Registro de compartilhamentos.
- Política de retenção.
- Gestão de incidentes.
- Política de privacidade.
- Termos de uso.
- Gestão de fornecedores e operadores.
- Controles para dados sensíveis.
- Procedimentos de atendimento aos titulares.

Não tratar consentimento como base legal obrigatória para todas as operações. A base legal deverá ser definida conforme a finalidade e o contexto de cada tratamento.

Não excluir automaticamente documentos financeiros, registros legais ou trilhas de auditoria que precisem ser preservados. Implementar retenção fundamentada e restrição de acesso.

---

## 23. BANCO DE DADOS

Projetar banco relacional normalizado, com migrações versionadas.

Entidades esperadas, ajustáveis conforme o projeto:
- tenants
- tenant_settings
- tenant_domains
- users
- user_credentials
- user_sessions
- roles
- permissions
- role_permissions
- user_tenant_memberships
- membership_roles
- residents
- resident_documents
- properties
- property_occupancies
- property_residents
- service_providers
- provider_documents
- contracts
- work_orders
- assets
- asset_maintenance
- common_areas
- reservations
- occurrences
- service_requests
- request_comments
- financial_accounts
- chart_of_accounts
- cost_centers
- financial_transactions
- receivables
- payables
- payment_attempts
- bank_reconciliations
- budgets
- budget_items
- financial_approvals
- invoices
- subscriptions
- subscription_events
- plans
- plan_features
- tenant_usage
- documents
- document_versions
- assemblies
- assembly_attendees
- agendas
- elections
- voting_eligibility
- votes
- minutes
- announcements
- notification_preferences
- notification_jobs
- employees
- shifts
- access_logs
- audit_logs
- support_tickets
- support_messages
- data_subject_requests
- integration_credentials
- webhook_events

Esta relação não é uma obrigação de criar tabelas desnecessárias. Modelar corretamente as relações, evitando tabelas genéricas excessivas e dados duplicados.

Aplicar:
- Chaves primárias consistentes.
- Chaves estrangeiras.
- Índices.
- Restrições de integridade.
- Transações.
- Paginação.
- Migrações.
- Exclusão lógica quando apropriada.
- Valores monetários com precisão decimal.
- Datas armazenadas de forma consistente.
- Histórico de alterações críticas.
- Estratégia de concorrência.
- Restrições de unicidade por associação.

Preferir PostgreSQL para produção. SQLite poderá ser usado em testes ou ambientes locais simplificados, sem comprometer as garantias necessárias à operação multiusuário.

---

## 24. ARQUITETURA TÉCNICA

Antes de começar, analise o ambiente e o repositório existentes.

Se não houver stack definida, adote preferencialmente:
- Frontend: Next.js com TypeScript.
- Interface: Tailwind CSS e biblioteca de componentes acessíveis.
- Backend: API organizada por módulos, com validação rigorosa.
- Banco de dados: PostgreSQL.
- ORM: Prisma ou alternativa consolidada compatível com a arquitetura.
- Filas: Redis com biblioteca de processamento adequada, quando necessário.
- Arquivos: armazenamento privado compatível com S3.
- Autenticação: solução consolidada, com sessões seguras e autorização própria por associação.
- Testes: ferramentas unitárias, integração e E2E.
- Infraestrutura: Docker e configuração de produção reproduzível.
- Observabilidade: logs estruturados, métricas e monitoramento de erros.

A stack poderá ser adaptada às limitações reais do projeto, mas a decisão deverá ser documentada.

Separar:
- Apresentação.
- Regras de negócio.
- Autenticação.
- Autorização.
- Persistência.
- Integrações.
- Tarefas assíncronas.
- Auditoria.
- Serviços de relatórios.

Evitar monólitos desorganizados, duplicação de regras, dependência excessiva do frontend e lógica financeira espalhada pelas telas.

---

## 25. DESIGN E EXPERIÊNCIA DO USUÁRIO

Criar uma interface moderna, profissional, institucional e comercialmente atraente.

Direção visual:
- Azul-marinho como cor principal.
- Azul médio para ações.
- Fundo claro com opção de tema escuro.
- Cards elegantes.
- Bordas discretas.
- Sombras leves.
- Ícones consistentes.
- Tipografia legível.
- Gráficos profissionais.
- Menus laterais organizados.
- Cabeçalho com associação ativa.
- Indicadores claros.
- Tabelas com filtros.
- Busca global.
- Notificações.
- Breadcrumbs.
- Formulários divididos por etapas.
- Estados vazios úteis.
- Confirmações de ações destrutivas.
- Mensagens de erro objetivas.
- Feedback de carregamento.
- Paginação.
- Layout responsivo.

Cada associação poderá personalizar logotipo, nome exibido e cores dentro dos limites definidos pelo SaaS.

Criar uma landing page comercial separada do ambiente autenticado, com:
- Apresentação do produto.
- Funcionalidades.
- Planos.
- Perguntas frequentes.
- Demonstração.
- Contato comercial.
- Cadastro de interesse.
- Termos de uso.
- Política de privacidade.

Garantir acessibilidade, navegação por teclado, contraste adequado e adaptação para desktop, tablet e celular.

---

## 26. AUTOMAÇÕES E REGRAS DE NEGÓCIO

Criar motor de automações configuráveis para:
- Avisar sobre cobranças próximas do vencimento.
- Notificar pagamentos confirmados.
- Alertar sobre inadimplência.
- Informar protocolos atrasados.
- Alertar contratos a vencer.
- Avisar sobre assembleias.
- Notificar pendências de aprovação.
- Alertar documentos vencidos.
- Lembrar tarefas recorrentes.
- Gerar relatórios periódicos.
- Notificar alterações de status.

Implementar processamento assíncrono quando necessário, idempotência, retentativas, monitoramento e registro de falhas.

Toda automação deverá respeitar as permissões, preferências de comunicação, limites de envio e configurações de cada associação.

---

## 27. TESTES, QUALIDADE E HOMOLOGAÇÃO

Desenvolver uma estratégia de testes desde o início.

### Testes unitários
- Regras financeiras.
- Cálculos de cobranças.
- Juros e descontos autorizados.
- Permissões.
- Validações.
- Fluxos de aprovação.
- Regras de elegibilidade para votação.

### Testes de integração
- Banco de dados.
- Autenticação.
- Criação de associação.
- Cadastro de usuários.
- Cobranças.
- Pagamentos simulados em ambiente de testes.
- Webhooks.
- Exportações.
- Uploads.
- Notificações.
- Auditoria.

### Testes E2E
- Cadastro de administrador.
- Criação de associação.
- Convite de usuários.
- Cadastro de morador.
- Criação de cobrança.
- Registro de despesa.
- Aprovação financeira.
- Abertura e encerramento de protocolo.
- Criação de assembleia.
- Geração de relatório.
- Gestão da assinatura SaaS.

### Testes de segurança
- Tentativa de acessar outro tenant.
- Escalada de privilégios.
- Alteração manual de IDs.
- Acesso a arquivos privados.
- Reutilização de sessão revogada.
- Abuso de endpoints.
- Webhooks inválidos.
- Importação de arquivos maliciosos.
- Acesso indevido por APIs.
- Manipulação de valores financeiros no cliente.

### Testes de desempenho
- Paginação de grandes tabelas.
- Consultas financeiras.
- Importação em lote.
- Geração de relatórios.
- Processamento de notificações.
- Concorrência em operações críticas.

Definir metas de desempenho mensuráveis antes de estabelecer os resultados. Não inventar aprovação em testes que não foram executados.

---

## 28. REQUISITOS DE ENTREGA

Organize a implementação por etapas, sem abandonar a arquitetura completa.

### Etapa 1 — Fundação
- Estrutura do projeto.
- Banco de dados.
- Migrações.
- Autenticação.
- MFA.
- Multi-tenancy.
- Autorização.
- Auditoria.
- Design system.
- Testes básicos.

### Etapa 2 — Associação e usuários
- Cadastro institucional.
- Unidades.
- Moradores.
- Convites.
- Perfis.
- Portal do morador.

### Etapa 3 — Operação administrativa
- Documentos.
- Comunicados.
- Ocorrências.
- Solicitações.
- Prestadores.
- Contratos.
- Patrimônio.
- Manutenção.

### Etapa 4 — Financeiro
- Plano de contas.
- Receitas.
- Despesas.
- Cobranças.
- Aprovações.
- Conciliação.
- Relatórios.
- Prestação de contas.

### Etapa 5 — Governança
- Assembleias.
- Atas.
- Eleições.
- Mandatos.
- Reservas.
- Funcionários.
- Portaria opcional.

### Etapa 6 — Monetização
- Planos.
- Assinaturas.
- Pagamentos SaaS.
- Limites.
- Suspensão controlada.
- Suporte.

### Etapa 7 — Produção
- Testes completos.
- Revisão de segurança.
- Monitoramento.
- Backups.
- Restauração.
- Documentação.
- Implantação.
- Homologação.

---

## 29. INSTRUÇÕES OBRIGATÓRIAS PARA O AGENTE DE DESENVOLVIMENTO

Antes de alterar arquivos:
1. Inspecione todo o repositório existente.
2. Identifique a stack, dependências e funcionalidades já implementadas.
3. Preserve recursos funcionais existentes.
4. Identifique falhas de arquitetura e segurança.
5. Apresente um plano técnico e uma lista de entregas.
6. Crie documentação da arquitetura e das decisões importantes.

Durante o desenvolvimento:
- Implemente código real, não apenas telas.
- Crie e execute migrações.
- Mantenha tipagem e validações.
- Centralize regras de negócio.
- Documente variáveis de ambiente.
- Utilize dados de demonstração exclusivamente em ambientes identificados como demonstração.
- Nunca inclua segredos no código.
- Não deixe botões sem ação.
- Não use respostas falsas de sucesso.
- Não esconda falhas de integração.
- Não desative verificações de segurança para facilitar os testes.
- Não marque módulos como concluídos sem testar seus fluxos essenciais.
- Não substitua funcionalidades existentes sem verificar seus efeitos.
- Não implemente módulos financeiros com cálculos improvisados.
- Não crie permissões apenas visuais.

Ao concluir cada etapa:
1. Execute os testes.
2. Corrija os erros encontrados.
3. Verifique migrações e integridade dos dados.
4. Revise os controles de autorização.
5. Teste o isolamento entre duas associações distintas.
6. Atualize a documentação.
7. Apresente um relatório objetivo do que foi efetivamente implementado.

Se o projeto for grande demais para uma única execução, continue por etapas, mantendo um arquivo de progresso, tarefas pendentes, decisões técnicas e critérios de aceitação.

Não descarte o escopo dos módulos ainda não implementados. Registre-os como pendentes e preserve a arquitetura para sua implementação posterior.

---

## 30. CRITÉRIOS FINAIS DE ACEITAÇÃO

O sistema somente deverá ser considerado funcionalmente homologado quando for possível demonstrar que:

1. Um administrador cria uma associação independente.
2. A associação configura seu ambiente institucional.
3. O administrador cria usuários com diferentes funções.
4. Cada função possui permissões efetivamente aplicadas no backend.
5. Moradores e unidades são cadastrados e relacionados corretamente.
6. O portal do morador apresenta apenas os dados autorizados.
7. Receitas, despesas e cobranças são registradas com integridade.
8. Aprovações financeiras respeitam as alçadas configuradas.
9. Prestadores, contratos, serviços e ocorrências funcionam de ponta a ponta.
10. Documentos e relatórios respeitam as permissões.
11. Assembleias, atas e votações seguem as regras configuradas.
12. A administração central controla planos e assinaturas SaaS.
13. Nenhuma associação consegue acessar os dados de outra.
14. As operações críticas deixam trilhas de auditoria.
15. Os backups podem ser restaurados e verificados.
16. Os testes automatizados essenciais são executados com resultados documentados.
17. O sistema possui instruções reproduzíveis de instalação, configuração, testes e implantação.
18. As funcionalidades anunciadas como disponíveis realmente funcionam.

ENTREGA FINAL ESPERADA:

Uma plataforma SaaS de gestão associativa profissional, modular, segura, multiusuário, multi-tenant, com administração central, ambientes independentes por associação, perfis de acesso distintos, gestão financeira, administrativa e operacional, portal do morador, governança, relatórios, auditoria e monetização por assinatura.

Priorize integridade dos dados, segurança, facilidade de administração, usabilidade e sustentabilidade da arquitetura. Desenvolva uma base sólida para evolução comercial do produto, sem sacrificar a qualidade em favor de uma demonstração visual rápida.
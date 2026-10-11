# Revisão de fluxos de autenticação e documentos — 11/10/2026

## Revisão estática adicional

- Rota autenticada consulta `supabase.auth.getUser()` e valida `profiles.account_status`; falha de rede, erro de consulta ou conta não aprovada não libera o painel.
- Redirecionamentos são filtrados por `safeInternalPath`, que rejeita URLs externas, barras invertidas e caracteres de controle.
- Aceitação de convite valida o formato UUID no cliente e delega a validação de e-mail, expiração, autoridade e uso ao RPC do banco. A validação do cliente é apenas UX; a segurança real depende da função no banco.
- Upload de documentos limita tamanho, extensão de nome, categoria, visibilidade e MIME declarado, e usa nome de arquivo normalizado e caminho por associação/documento. O MIME informado pelo navegador pode ser falsificado; os arquivos ainda precisam ser tratados como não confiáveis, e a homologação deve incluir teste de conteúdo real e downloads com duas contas.
- Download usa URL assinada de curta duração (60 segundos). Isso reduz exposição de URLs permanentes para documentos privados, mas não substitui a política de autorização no Storage.

## Teste executado

A chamada SQL transacional à RPC pública sob papel `anon`, com código malformado, retornou zero linhas. Nenhuma linha de associação foi exposta nesse teste.

## CI/CD

- [Quality checks — sucesso](https://github.com/DevKove/project-genesis/actions/runs/38151325331)
- [Deploy GitHub Pages — sucesso](https://github.com/DevKove/project-genesis/actions/runs/38151325329)
- [Deploy Cloudflare — ignorado pela condição do workflow](https://github.com/DevKove/project-genesis/actions/runs/38151325293)

## Pendências críticas

O Security Advisor ainda sinaliza proteção contra senhas comprometidas desabilitada. Também permanecem pendentes chamadas HTTP reais autenticadas à Edge Function, testes de isolamento com duas contas reais, testes de upload/download e varredura completa de segredos no histórico Git. O sucesso de CI confirma lint/test/build automatizados, não um pentest completo.

**Status: auditoria parcial. Não declarar produção homologada até concluir as verificações pendentes.**

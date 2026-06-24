# Roadmap de produto e UI/UX

Este documento registra as melhorias identificadas para o Entrelinhas, com foco em clareza,
importação, transcrições, biblioteca local e experiência de escuta.

## Princípios do produto

- O Entrelinhas é um player e organizador local de audiobooks.
- A transcrição é opcional.
- O aplicativo não transcreve áudio no GitHub Pages.
- Arquivos importados não são enviados para servidores.
- Biblioteca, progresso e marcadores pertencem ao navegador e ao dispositivo atuais.
- A interface deve explicar conceitos sem exigir conhecimento de VTT, IndexedDB ou PWA.

## Prioridade imediata

- [x] Explicar que o Entrelinhas não cria transcrições.
- [x] Criar onboarding para a primeira visita.
- [x] Criar um guia sobre obtenção e importação de transcrições.
- [x] Mostrar uma prévia dos arquivos e do pareamento antes da importação.
- [x] Diferenciar transcrição sincronizada, texto não sincronizado e ausência de transcrição.
- [x] Corrigir o carregamento de transcrições Markdown importadas.
- [x] Salvar progresso em intervalos, em vez de gravar a cada evento do player.
- [x] Confirmar conclusão ou falha do download offline.
- [x] Calcular progresso real por duração, em vez de contar seções iniciadas.

## Biblioteca

- [x] Separar visualmente biblioteca e livro aberto.
- [x] Exibir livros como entidades, sem misturar as faixas de obras diferentes.
- [x] Permitir excluir livros e liberar seus dados associados.
- [ ] Permitir renomear, reordenar e adicionar capa.
- Permitir adicionar ou substituir uma transcrição depois da importação.
- [x] Mostrar espaço ocupado e espaço disponível estimado.
- [x] Solicitar armazenamento persistente quando suportado.
- Alertar que limpar os dados do navegador pode apagar a biblioteca.
- Exportar e importar um pacote completo de backup.
- Liberar URLs temporárias de arquivos locais quando deixarem de ser usadas.

## Importação

- Evoluir o formulário para um fluxo em etapas:
  1. informações do livro;
  2. seleção e ordenação das faixas;
  3. transcrições opcionais e resultado do pareamento;
  4. revisão e confirmação.
- Permitir renomear e reordenar faixas antes de salvar.
- Exibir arquivos incompatíveis, ignorados e sem correspondência.
- Informar quantidade e tamanho total dos arquivos.
- Usar terminologia consistente:
  - livro: audiobook completo;
  - faixa: arquivo de áudio;
  - capítulo: divisão literária, quando conhecida;
  - transcrição: texto associado à faixa.

## Transcrições

- Explicar a diferença entre:
  - WebVTT: texto sincronizado com o áudio;
  - Markdown: texto de leitura, sem sincronização temporal.
- Documentar pareamento por nome, por exemplo `01.mp3` com `01.vtt`.
- Orientar o usuário a buscar textos legalmente disponíveis em bibliotecas digitais.
- Explicar que texto integral e transcrição sincronizada são coisas diferentes.
- Recomendar ferramentas externas ou locais que exportem VTT, com alerta de privacidade para
  serviços online.
- Não priorizar criação de transcrição no navegador enquanto custo, desempenho em celulares e peso
  da solução forem incompatíveis com a proposta simples do projeto.

## Player e navegação

- [x] Criar um miniplayer fixo ao navegar pela biblioteca e transcrição.
- [x] Priorizar no celular: título, play/pause e progresso.
- [x] Mover controles menos frequentes para “Mais opções”.
- Exibir progresso total real e conclusão por faixa.
- Melhorar estados vazios com orientação e próxima ação.
- Permitir navegar entre livro, faixas, transcrição e marcadores sem misturar apresentação
  institucional com a tela de escuta.

## Offline e confiabilidade

- [x] Fazer o Service Worker responder ao aplicativo após concluir ou falhar um download.
- [x] Mostrar estado “baixando”, “disponível offline” e “erro”.
- Permitir remover uma faixa do armazenamento offline.
- Testar atualização do Service Worker e reprodução offline na publicação.
- Tratar falhas e limites de quota de armazenamento com mensagens acionáveis.

## Qualidade e testes

- [x] Adicionar testes para importação via IndexedDB.
- [x] Testar Markdown local.
- [ ] Testar VTT local.
- [ ] Testar marcadores, retomada, teclado e preferências.
- [x] Testar onboarding e guia de transcrições.
- Adicionar auditoria automatizada de acessibilidade.
- Executar os testes E2E no workflow antes da publicação.

# Roadmap do Entrelinhas

Este documento acompanha decisões e melhorias planejadas para o Entrelinhas. O foco é manter a experiência simples: ouvir audiobooks no navegador, preservar dados localmente e explicar bem o que acontece com os arquivos do usuário.

## Princípios do produto

- O Entrelinhas é um player e organizador local de audiobooks.
- A transcrição é opcional.
- O aplicativo não transcreve áudio no GitHub Pages.
- Arquivos importados não são enviados para servidores.
- Biblioteca, progresso e marcadores pertencem ao navegador e ao dispositivo atuais.
- A interface deve explicar conceitos sem exigir conhecimento prévio de VTT, IndexedDB ou PWA.

## Já implementado

- Onboarding para a primeira visita.
- Guia sobre obtenção e importação de transcrições.
- Prévia dos arquivos e do pareamento antes da importação.
- Diferenciação entre transcrição sincronizada, texto não sincronizado e ausência de transcrição.
- Carregamento de transcrições Markdown importadas.
- Progresso salvo em intervalos, evitando gravação a cada evento do player.
- Confirmação de conclusão ou falha do download offline.
- Cálculo de progresso por duração.
- Biblioteca separada visualmente do livro aberto.
- Exclusão de livros importados e dados associados.
- Miniplayer fixo durante navegação.
- Testes para importação via IndexedDB, Markdown local, onboarding e guia de transcrições.
- Execução de testes E2E no workflow de publicação.

## Próximos ajustes

- Permitir renomear, reordenar e adicionar capa aos audiobooks importados.
- Permitir adicionar ou substituir uma transcrição depois da importação.
- Exportar e importar um pacote completo de backup.
- Remover faixas específicas do armazenamento offline.
- Melhorar estados vazios com orientação e próxima ação.
- Ampliar testes de VTT local, marcadores, retomada, teclado e preferências.
- Adicionar auditoria automatizada de acessibilidade.

## Biblioteca

- [x] Separar visualmente biblioteca e livro aberto.
- [x] Exibir livros como entidades, sem misturar as faixas de obras diferentes.
- [x] Permitir excluir livros e liberar seus dados associados.
- [ ] Permitir renomear, reordenar e adicionar capa.
- [ ] Permitir adicionar ou substituir uma transcrição depois da importação.
- [x] Mostrar espaço ocupado e espaço disponível estimado.
- [x] Solicitar armazenamento persistente quando suportado.
- [ ] Alertar que limpar os dados do navegador pode apagar a biblioteca.
- [ ] Exportar e importar um pacote completo de backup.
- [ ] Liberar URLs temporárias de arquivos locais quando deixarem de ser usadas.

## Importação

- [ ] Evoluir o formulário para um fluxo em etapas:
  1. informações do livro;
  2. seleção e ordenação das faixas;
  3. transcrições opcionais e resultado do pareamento;
  4. revisão e confirmação.
- [ ] Permitir renomear e reordenar faixas antes de salvar.
- [ ] Exibir arquivos incompatíveis, ignorados e sem correspondência.
- [ ] Informar quantidade e tamanho total dos arquivos.
- [x] Usar terminologia consistente:
  - livro: audiobook completo;
  - faixa: arquivo de áudio;
  - capítulo: divisão literária, quando conhecida;
  - transcrição: texto associado à faixa.

## Transcrições

- [x] Explicar a diferença entre:
  - WebVTT: texto sincronizado com o áudio;
  - Markdown: texto de leitura, sem sincronização temporal.
- [x] Documentar pareamento por nome, por exemplo `01.mp3` com `01.vtt`.
- [x] Orientar o usuário a buscar textos legalmente disponíveis em bibliotecas digitais.
- [x] Explicar que texto integral e transcrição sincronizada são coisas diferentes.
- [x] Recomendar ferramentas externas ou locais que exportem VTT, com alerta de privacidade para serviços online.
- [x] Não priorizar criação de transcrição no navegador enquanto custo, desempenho em celulares e peso da solução forem incompatíveis com a proposta simples do projeto.

## Player e navegação

- [x] Criar um miniplayer fixo ao navegar pela biblioteca e transcrição.
- [x] Priorizar no celular: título, play/pause e progresso.
- [x] Mover controles menos frequentes para “Mais opções”.
- [ ] Exibir progresso total real e conclusão por faixa.
- [ ] Melhorar estados vazios com orientação e próxima ação.
- [ ] Permitir navegar entre livro, faixas, transcrição e marcadores sem misturar apresentação institucional com a tela de escuta.

## Offline e confiabilidade

- [x] Fazer o Service Worker responder ao aplicativo após concluir ou falhar um download.
- [x] Mostrar estado “baixando”, “disponível offline” e “erro”.
- [ ] Permitir remover uma faixa do armazenamento offline.
- [ ] Testar atualização do Service Worker e reprodução offline na publicação.
- [ ] Tratar falhas e limites de quota de armazenamento com mensagens acionáveis.

## Qualidade e testes

- [x] Adicionar testes para importação via IndexedDB.
- [x] Testar Markdown local.
- [ ] Testar VTT local.
- [ ] Testar marcadores, retomada, teclado e preferências.
- [x] Testar onboarding e guia de transcrições.
- [ ] Adicionar auditoria automatizada de acessibilidade.
- [x] Executar os testes E2E no workflow antes da publicação.

# Entrelinhas — PWA local-first para audiobooks

Entrelinhas é um aplicativo web instalável para ouvir, organizar e retomar audiobooks no navegador. Ele funciona como uma estante local: o usuário pode experimentar uma amostra pública de **Dom Casmurro**, importar seus próprios arquivos de áudio, salvar progresso por seção e criar marcadores.

O projeto foi iniciado como um estudo prático de player de áudio em JavaScript e evoluiu para uma PWA local-first, com foco em continuidade de escuta, privacidade local e uma experiência reutilizável para diferentes audiobooks.

Criado por **Marcus Guedes**.

## Demo

Versão publicada: [marcusguedess.github.io/entrelinhas](https://marcusguedess.github.io/entrelinhas/)

## Status

Projeto gratuito em evolução. A aplicação já permite escutar a amostra hospedada, importar audiobooks locais, salvar progresso, usar marcadores e trabalhar com transcrições quando disponíveis. Ainda há melhorias planejadas para organização da biblioteca, edição de metadados e empacotamento/exportação de audiobooks.

## Prévia

![Entrelinhas em modo claro](docs/screenshots/desktop-light.png)

![Entrelinhas em modo escuro](docs/screenshots/desktop-dark.png)

## Funcionalidades

- Player customizado com play/pause, avanço/retorno de 15 segundos e navegação entre seções.
- Progresso, tempo ouvido, volume, velocidade, tema e marcadores salvos localmente.
- Biblioteca local com importação de áudios e transcrições `.vtt` ou `.md` via IndexedDB.
- Transcrição WebVTT sincronizada quando disponível, com busca e controle de acompanhamento do áudio.
- Marcadores com anotação, exportação e importação em JSON.
- Miniplayer responsivo, modo noturno e modo escuta.
- Modo offline via Service Worker para app shell e seções selecionadas da amostra pública.
- Ferramentas em Python para servir localmente, validar catálogo e gerar arquivos auxiliares.

## Decisões de produto

- **Local-first no navegador:** os arquivos importados ficam no dispositivo do usuário via IndexedDB. O projeto não tem backend, conta de usuário ou upload de biblioteca pessoal.
- **Dom Casmurro como amostra pública:** a obra em domínio público permite demonstrar player, transcrição, marcadores e offline sem depender de conteúdo privado do usuário.
- **Importação de arquivos próprios:** a proposta não é ser um catálogo fechado, mas uma interface para organizar audiobooks que o usuário já possui.
- **Transcrição opcional:** o app consome WebVTT ou Markdown quando o usuário já tem esses arquivos, mas não transcreve áudio.

## Stack

- HTML, CSS e JavaScript modular sem framework.
- Service Worker e Cache API para recursos offline.
- IndexedDB para a biblioteca local de audiobooks importados.
- LocalStorage para preferências, progresso e marcadores.
- WebVTT para transcrição sincronizada.
- Python standard library para servidor local, validação e testes.
- GitHub Actions + GitHub Pages para publicação.

## Estrutura principal

```text
Entrelinhas/
  index.html
  style.css
  sw.js
  audios/
  data/
    catalog.json
  imagens/
  js/
    app.js
    catalog.js
    library.js
    storage.js
    transcript.js
  transcripts/
tools/
  audiobook.py
  md_to_vtt.py
tests/
  test_audiobook.py
```

## Rodando localmente

Use o servidor do próprio projeto. Ele serve a pasta pública correta (`Entrelinhas`) e envia cabeçalhos compatíveis com a PWA.

```powershell
python tools\audiobook.py catalog
python tools\audiobook.py validate
python tools\audiobook.py serve --port 8000
```

Depois abra:

```text
http://127.0.0.1:8000
```

Evite abrir `index.html` diretamente por `file://` ou servir a raiz errada do repositório. Isso pode quebrar catálogo, caminhos de mídia e comportamento do Service Worker.

## Transcrições

O app consome preferencialmente arquivos WebVTT (`.vtt`). Para edição manual da amostra hospedada, os arquivos Markdown (`.md`) servem como fonte textual e os `.vtt` são gerados pelo script do projeto.

```powershell
python tools\md_to_vtt.py
python tools\audiobook.py catalog
python tools\audiobook.py validate
```

Ao importar um audiobook pelo navegador, selecione os áudios e as transcrições juntos. O pareamento é feito pelo nome:

```text
1.mp3  -> 1.vtt
01.mp3 -> 01.vtt
capitulo-1.mp3 -> capitulo-1.vtt
```

Os arquivos importados ficam no navegador via IndexedDB; nada é enviado para servidor.

## Scripts úteis

```powershell
npm run catalog
npm run icons
npm run transcripts
npm run validate
npm test
npm run lint
npm run test:e2e
npm run serve
npm run screenshots
```

## Validação

Antes de publicar ou abrir pull request, rode:

```powershell
python tools\audiobook.py validate
python -m unittest discover -s tests
npm run lint
npm run test:e2e
```

O workflow em `.github/workflows/deploy.yml` executa validação, testes, lint e testes E2E antes de publicar a pasta `Entrelinhas` no GitHub Pages.

## Limitações atuais

- O app não cria transcrições automaticamente.
- A biblioteca importada fica vinculada ao navegador e ao dispositivo atuais.
- Limpar dados do site pode apagar audiobooks importados, progresso e marcadores.
- A edição visual de capa, nomes e ordem das faixas ainda não está disponível.
- Exportação/importação de pacotes completos de biblioteca ainda está no roadmap.

## Segurança e privacidade

- Arquivos importados pelo usuário ficam no próprio navegador via IndexedDB.
- Nenhum áudio importado é enviado para servidor.
- O projeto não coleta dados do usuário e não tem backend próprio nesta versão.
- A interface evita `innerHTML` para conteúdo dinâmico e constrói a UI com APIs seguras de DOM.
- A política CSP restringe scripts, mídia, imagens e conexões à própria origem.
- O servidor Python local adiciona cabeçalhos como CSP, `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy`.

## Roadmap

O roadmap de produto e UI/UX está em [`docs/UX_ROADMAP.md`](docs/UX_ROADMAP.md).

Próximos pontos planejados:

- Revisar o alinhamento temporal das transcrições `.vtt`.
- Permitir renomear, reordenar e adicionar capa em audiobooks importados.
- Permitir adicionar ou substituir transcrições depois da importação.
- Exportar/importar pacotes completos de biblioteca.
- Ampliar testes automatizados para marcadores, preferências e funções JavaScript puras.

## Créditos e direitos

Dom Casmurro é uma obra em domínio público. As gravações usadas na amostra indicam origem LibriVox nas próprias transcrições.

O código está licenciado sob MIT em `LICENSE`. Essa licença cobre o código do projeto; obras, áudios, capas e transcrições devem manter créditos e licenças próprios.

# Achados do Casal — MASTER DO PROJETO

> **FONTE MESTRE / LEITURA OBRIGATÓRIA**
>
> Este arquivo existe para impedir perda de contexto entre chats, agentes, sessões e meses de desenvolvimento.
> Antes de alterar o Achados do Casal, leia este arquivo, confira os commits mais recentes da `main`, o estado do deploy de produção e, quando a mudança tocar dados, o estado real do Supabase.
>
> **Última consolidação:** 16/11/2026
> **Responsável:** Gabriel Calvi / Achados do Casal
> **Baseline técnico anterior a este documento:** `1c9b071e10308d13443bdda41fc417aceb27fec2`
> **Commit baseline:** `fix: respeita loja solicitada na coleta Awin`

---

## 1. Regras permanentes do projeto

1. **Não reinventar fluxos já resolvidos.** Antes de criar uma solução nova, verificar commits, código atual e este documento.
2. **Nunca publicar oferta sem monetização válida quando a origem exigir afiliado.**
3. **Produtos manuais não podem ser alterados pelo monitor automático.**
4. **Reviews podem continuar indexáveis mesmo quando a oferta estiver inativa.**
5. **Pacotes de viagem não publicáveis devem continuar bloqueados inclusive por URL direta.**
6. **Horários mostrados ao usuário devem respeitar o fuso do Brasil/Brasília quando aplicável.**
7. **Toda automação deve registrar execução, falhas e permitir diagnóstico.**
8. **Mudanças de produção devem ser verificadas após deploy.**
9. **Não remover proteções, filtros, regras de deduplicação, affiliate guardrails, RLS ou watchdog sem entender por que foram criados.**
10. **Quando houver dúvida entre memória de conversa e estado real do sistema, o código, o banco e a produção prevalecem.**

---

## 2. Infraestrutura atual

### Repositório
- GitHub: `gabrielcalvi/achados-do-casal`
- Branch de produção: `main`

### Vercel
- Team: `ACHADOS`
- Team ID: `team_0CKxtwEDL8irqdErEAY4cLLm`
- Project: `achados-do-casal`
- Project ID: `prj_coa8aSyGbro5Phn3BYONZ3ui3kq3`
- Framework: Next.js
- Domínio principal: `achadosdocasal.com.br`
- Aliases adicionais incluem `achados-do-casal.vercel.app`

### Supabase
- Project: `Achados-do-casal`
- Project ref: `jssuebeloopmdstofdiy`
- Região: `sa-east-1`
- Status em 14/11/2026: `ACTIVE_HEALTHY`

### Stack
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase JS + SSR
- Vercel Analytics
- Playwright
- Puppeteer Core
- Chromium serverless via `@sparticuz/chromium-min`
- Axios
- Cheerio

---

## 3. Estado de produção — revisão geral em 16/11/2026

### Baseline atual validada
- Branch de produção: `main`
- Commit em produção auditado: `fa09b8cac31a1f363504269cc6e1e3010757b33f`
- Deployment Vercel: `dpl_Dd9cssMvP3ifeMAFB6TFoQH4SpoS`
- Status: **READY**
- Domínio principal confirmado: `achadosdocasal.com.br`

Rotas públicas verificadas diretamente na produção com HTTP 200:
- `/`
- `/economize`
- `/black-friday`
- `/reviews`
- `/gamer`
- `/viagens`
- página de produto
- página de achado/oferta
- página de pacote de viagem
- páginas públicas de parceiros
- `/sitemap.xml`
- `/robots.txt`

A página `/lauri-esporte` continua sem vitrine própria útil e cai na Central Economize, preservando a regra de não destacar parceiro sem ofertas reais.

### Estado operacional consultado no Supabase em 16/11/2026
- 18 produtos ativos
- 4 reviews completas
- 2 produtos com vídeo
- 785 ofertas ativas
- 126 cupons ativos e válidos no instante da auditoria
- 1 venda confirmada
- R$ 299,90 em valor vendido registrado
- R$ 29,51 em comissão registrada

Qualidade dos dados:
- 0 produtos ativos sem link de destino
- 0 produtos ativos sem preço
- 1 produto ativo sem imagem: produto 105, Galão 5L Speed Power do Mercado Livre
- o produto 105 estava classificado incorretamente como `Tecnologia`; foi corrigido no Supabase para `Automotivo` em 16/11/2026
- a imagem do produto 105 continua pendente; não inventar/substituir por imagem sem fonte confiável
- 0 ofertas ativas vencidas por data
- 0 cupons ativos vencidos
- 0 cupons ativos sem código

### Runtime e integrações
Nos 30 minutos finais da auditoria:
- **0 erros de runtime**
- **0 warnings de runtime**

Ocorrências recentes encontradas no histórico de 24h/7d:
1. `/api/admin/economize/catalogo/revisar`: falhas esporádicas `JWT issued at future` ao falar com Supabase. O Supabase Health Advisor não reportou falhas e a produção terminou a auditoria sem novos erros; acompanhar como incidente intermitente, não como quebra estrutural confirmada.
2. `/api/preparar-produto`: erro ao tentar identificar catálogo/User Product em um link Mercado Livre. Isso reforça a decisão operacional de manter o cadastro de produtos ML manual quando o formato não for reconhecido.
3. **Piloto ML Price Monitor V3 — 16/11/2026:** foi testada a API oficial nova de preços do Mercado Livre em **todos os 7 produtos ML ativos**. Para cada ITEM_ID conhecido, foram consultados `GET /items/{ITEM_ID}/sale_price?context=channel_marketplace` e `GET /items/{ITEM_ID}/prices` com o OAuth válido do projeto. Resultado: **7/7 retornaram HTTP 403 `Access to the requested resource is forbidden` nos dois endpoints**. Nenhum preço foi alterado. Conclusão operacional atual: manter produtos Mercado Livre com `monitoramento_manual=true`; não reativar automação de preço baseada em API até existir permissão/integração oficial que permita ler preços de anúncios de terceiros. O endpoint temporário usado no preview foi removido após o teste.
4. Radar de Viagens Expandido: histórico de respostas Ignav HTTP 424 em várias rotas; manter diagnóstico/watchdog e não tratar como erro do frontend público.

### Supabase Advisors e grants — 16/11/2026
- Health: sem lints.
- Security: `Leaked Password Protection Disabled` continua como aviso real do Auth.
- `RLS enabled no policy` aparece em várias tabelas. A auditoria confirmou dois cenários:
  - tabelas server-only já sem grants para `anon/authenticated`, como `economize_vendas`, `economize_campanha_visitas`, watchdog e algumas tabelas de viagens;
  - tabelas antigas que ainda possuem grants amplos para `anon/authenticated`, porém continuam sem políticas RLS. Nelas, o RLS bloqueia o acesso a linhas por padrão, então o grant não significa exposição pública efetiva; ainda assim os grants são mais permissivos do que o necessário e devem ser reduzidos de forma gradual após conferir quem usa cada tabela.
- Prioridade de hardening: revisar primeiro tabelas sensíveis/operacionais como `mercado_livre_tokens`, `monitor_alteracoes`, `monitor_execucoes`, `economize_execucoes` e `economize_verificacoes`; não fazer revogação em massa sem conferir os consumidores existentes.
- Performance: 5 foreign keys sem índice de cobertura foram sinalizadas: `economize_execucoes.loja_id`, `economize_verificacoes.execucao_id`, `produto_imagens.produto_id`, `viagens_pacotes.created_by` e `viagens_precos.execucao_id`.
- Índices não utilizados não devem ser removidos automaticamente apenas pelo advisor.

### Histórico anterior — 14/11/2026

Estado final validado após as correções estruturais de social + Viagens:

- Deployment ID: `dpl_EK8LgBhDHN3FVc4AESdUA58nX5kA`
- Commit: `14fd7fb432235fb7dc77cc1846a32ef194791990`
- Commit: `fix: ajusta sitemap para ofertas de viagem`
- Status: **READY**
- Domínio principal: `achadosdocasal.com.br`
- `/viagens`: HTTP 200
- `/viagens/pacote/d36900cb-bb92-46ee-b3d9-7b6f0c9ba14c`: HTTP 200
- URL antiga `/viagens/ingresso/d36900cb-bb92-46ee-b3d9-7b6f0c9ba14c`: preservada por redirecionamento permanente
- `/api/social/achado/[id]`: PNG HTTP 200 nos testes finais
- Vercel Runtime Errors: **0 erros** na janela final de validação de 10 minutos

### Erro social — RESOLVIDO
O erro recorrente `failed to pipe response` / `TypeError: u2 is not iterable` foi tratado em 14/11/2026.

Correção aplicada:
- o `ImageResponse` é materializado por completo antes de a resposta HTTP ser enviada;
- a rota passa a devolver um PNG normal, reduzindo dependência de streaming;
- imagens remotas usadas no card são restritas a formatos seguros JPEG/PNG, com fallback quando necessário.

Validação:
- oferta com imagem JPG: PNG HTTP 200;
- oferta com imagem SVG na origem: fallback seguro, PNG HTTP 200;
- zero erros de runtime observados após o deploy final.

PR principal: **#33**
Commit principal: `c11359d5571c1f4416cd27b82bfc34ae1f32e351`.

---

## 4. Produto e proposta do site

O Achados do Casal reúne:
- ofertas de produtos;
- cupons;
- promoções;
- campanhas;
- cashback;
- reviews reais do casal;
- links afiliados;
- conteúdo gamer;
- vertical de viagens;
- radar de preços de viagem;
- pacotes e ingressos;
- automações de coleta, revisão, monitoramento e watchdog.

A home pública usa posicionamento de “achados que realmente valem a pena”, com:
- busca;
- categorias;
- destaques de parceiros;
- acesso à Central Economize;
- acesso a Viagens;
- WhatsApp;
- Instagram;
- Gamer;
- Reviews do Casal.

---

## 5. Central Economize

### Histórico
A Central Economize foi construída em fases desde julho/agosto de 2026:
- banco de dados;
- API pública;
- página pública;
- admin;
- filtros;
- edição/exclusão;
- redirecionamento seguro;
- tracking de cliques;
- imagens;
- cupons vinculados;
- visual público;
- agentes/coletas;
- AWIN;
- Mercado Livre V2;
- SEO;
- revisão de catálogo.

### Tipos de oportunidade
A tabela `economize_ofertas` aceita:
- `cupom`
- `cashback`
- `promocao`
- `campanha`
- `frete_gratis`

### Estados
- `pendente`
- `ativo`
- `expirado`
- `inativo`
- `erro`

### Estrutura operacional confirmada no Supabase
Principais tabelas:
- `economize_lojas`
- `economize_fontes`
- `economize_ofertas`
- `economize_cupons`
- `economize_cupons_ofertas`
- `economize_cupons_candidatos`
- `economize_execucoes`
- `economize_verificacoes`
- `economize_cliques`

Em 14/11/2026:
- `economize_lojas`: 20 registros
- `economize_ofertas`: 11.379 registros
- `economize_cupons`: 301
- `economize_cupons_candidatos`: 546
- `economize_execucoes`: 399
- `economize_cliques`: 191

### Regra crítica de afiliado
Há histórico explícito de:
- exigir afiliado em oferta com cupom;
- gerar deeplink afiliado em AWIN;
- Mercado Livre V2 só publicar candidato após validação buyer-side, participação do item, código público quando necessário e link `meli.la`;
- preservar link monetizado em integrações e redirecionamentos.

---

### Radar permanente de Cupons — decisão de 16/11/2026
A Black Friday virou a campanha de lançamento da central, mas o mecanismo de cupons é **permanente**.

Regras:
- o radar não encerra mais depois da Black Friday;
- cron continua a cada 3 horas;
- após 03/12/2026 a linguagem deixa de ser Black Friday e passa a ser Cupons;
- validação, deduplicação, expiração e tracking continuam iguais;
- Cobasi, Microsoft Store/Xbox e Nuuvem foram adicionadas explicitamente ao radar;
- campanhas sazonais mudam a comunicação, não o motor.

Próxima tematização definida:
- **Achados de Natal**
- proposta: cupons, presentes e ofertas monitoradas todos os dias;
- depois do Natal a central continua funcionando normalmente.

### Black Friday 2026 — Central de Cupons
Campanha temporária criada em 14/11/2026 para aproveitar o pico de busca por cupons durante a Black Friday sem depender somente das lojas afiliadas.

Objetivo:
- gerar tráfego qualificado;
- ampliar autoridade do Achados do Casal como central de economia;
- monetizar quando existir parceria;
- não descartar cupom bom de marca não parceira.

Arquitetura:
- página pública `/black-friday`;
- banner de acesso na home;
- sitemap com prioridade alta durante a campanha;
- radar automático `/api/admin/economize/black-friday/radar`;
- cron a cada 3 horas (`25 */3 * * *`);
- encerramento automático após `2026-12-03T03:00:00Z`;
- dados continuam usando `economize_cupons`, `economize_ofertas`, `economize_cupons_ofertas` e `economize_cliques`; não foi criado sistema paralelo.

Regra comercial:
- lojas com automação de cupons já ativa continuam usando seu pipeline comprovado;
- radar Black Friday não duplica essas lojas;
- marcas sem parceria podem entrar como **tráfego**;
- sem afiliado, o clique vai diretamente para o site oficial da loja e continua sendo rastreado pelo Achados;
- nunca inventar link afiliado.

Critério automático de qualidade do radar:
- regra conservadora de múltiplos percentuais: se a fonte misturar desconto geral da promoção com desconto extra do cupom (ex.: 60% OFF + cupom de 20%), o radar registra o menor percentual para não inflar o benefício anunciado;
- código precisa ter formato plausível;
- cupom precisa estar publicado na fonte;
- validade ainda ativa;
- benefício relevante: pelo menos 10% OFF, pelo menos R$ 20 OFF ou frete grátis;
- precisa existir registro de uso recente (até 72h) na fonte monitorada;
- apenas candidatos que cumprem todos os critérios entram automaticamente como ativos;
- candidatos insuficientes ficam `pendente`, não aparecem ao público;
- cupons que deixam de ser encontrados na revalidação são inativados;
- validade operacional é limitada para obrigar rechecagem frequente.

Fonte inicial validada no ambiente:
- Samsung validada no radar via Cuponation, com códigos estruturados, validade e `lastUsedDate`; exemplos atuais encontrados incluem `LIVE1111`, `BF2026`, `APPWEEK` e `LIVESHOP`, enquanto códigos abaixo de 10% não passam pela regra de benefício relevante;
- Cuponation responde com dados estruturados contendo código, título, início, validade, publicação e `lastUsedDate`;
- Méliuz responde, mas mascara o código na página, portanto não é usado como fonte principal de código no primeiro radar;
- Cuponomia bloqueou o servidor com HTTP 403 e não é dependência do radar.

Lojas iniciais do radar incluem Adidas, Magalu, Casas Bahia, Renner, Nike, Samsung, Dell, Lenovo, Riachuelo, Centauro, Netshoes, Sephora, O Boticário, Natura, Petz, Fast Shop, Carrefour, Pichau, Electrolux e Brastemp. A lista pode crescer, sempre preservando a regra de qualidade.

Tracking:
- `/oferta/[id]` reconhece ofertas `black_friday_radar_2026` com `black_friday_trafego=true`;
- permite link direto quando não há afiliado;
- cliques continuam gravados em `economize_cliques`;
- origem `black_friday` é aceita para medir desempenho da campanha.

### Estratégia de fontes por loja — Black Friday
A partir de 14/11/2026 o radar deixou de depender de uma fonte única.

Prioridade:
1. fonte oficial da própria loja, quando existir;
2. fonte agregadora validada com código, validade e/ou uso recente;
3. candidato sem evidência suficiente fica pendente ou nem é criado.

Fontes oficiais já incorporadas ao radar:
- **Renner** → `https://www.lojasrenner.com.br/cupom-de-desconto`;
- **Marisa** → página oficial de regras/promoções;
- **Nike** → página oficial de cupons para confirmação dos códigos oficiais.

Cuponation continua como fonte estruturada secundária para lojas em que entrega código, validade, publicação e `lastUsedDate`.

#### Expansão de cobertura — 14/11/2026
O radar foi ampliado para acompanhar novas categorias solicitadas:
- **Cafés:** Nespresso, Nescafé Dolce Gusto, Café L'OR e Baggio Café;
- **Acessórios/lifestyle:** GoCase;
- **Brinquedos:** Superlegal Brinquedos, Ri Happy, PBKIDS, LEGO e Mattel;
- **Varejo/eletro:** Lojas Colombo e Pontofrio;
- **Magalu** permanece no radar existente.

Fontes oficiais de código incorporadas:
- Nespresso → página oficial Brasil;
- GoCase → página oficial de campanhas/cupons.

O extrator de fonte oficial agora reconhece tanto padrões "Cupom CODIGO" quanto "Use o cupom: CODIGO". Isso permite capturar códigos apresentados no conteúdo promocional oficial sem depender de URL presumida de agregador.

Para as demais lojas, a descoberta usa a busca do radar e fontes secundárias; nenhuma URL de agregador foi fixada sem validação. A inclusão no radar significa monitorar, não publicar automaticamente: permanecem obrigatórios código real, benefício relevante, validade e critérios de evidência da fonte. Lojas com automação de cupons já ativa continuam protegidas contra duplicação.

A cobertura deve ser reavaliada continuamente pelo cron existente (a cada 3 horas). Cupons que deixam de aparecer na fonte são inativados; códigos novos são deduplicados antes de serem inseridos.


Em 14/11/2026 foram validadas e fixadas URLs diretas da Cuponation para **Netshoes, Centauro, O Boticário, Casas Bahia e Sephora**. Todas responderam HTTP 200 no ambiente Vercel e retornaram códigos estruturados. Antes da publicação, o radar continua exigindo `published=true`, validade ativa, benefício relevante e `lastUsedDate` recente.

O filtro de códigos foi endurecido para descartar nomes de ícones/asset keys como `arrow`, `shopping`, `calendar`, `star`, `phone`, `tag`, `credit`, `coins` e `message`, evitando falsos cupons.

Lojas prioritárias adicionadas/monitoradas:
- Renner;
- C&A (mantida no pipeline próprio existente, sem duplicar no radar);
- Nike;
- Apple;
- Gaston;
- Marisa;
- Amazon;
- Americanas;
- Decathlon;
- Dafiti;
- Zattini;
- além das demais lojas grandes já existentes no radar.

Regra: marca atraente sem cupom verificável continua no radar, mas **não entra no público só para preencher a página**.


### Estado da Central Black Friday em produção — 14/11/2026
Após a ampliação do radar, a API pública de cupons retornava **48 ofertas de cupom ativas**.

Distribuição relevante:
- Renner: 12;
- C&A: 3;
- Samsung: 5;
- Netshoes: 5;
- Centauro: 5;
- O Boticário: 5;
- Adidas: 3;
- Sephora: 3;
- Casas Bahia: 2;
- Marisa: 1;
- Nike: 1.

O radar Black Friday respondia por **44 cupons ativos**; os demais vinham de pipelines parceiros já existentes.

Novas fontes diretas validadas e liberadas:
- Netshoes;
- Centauro;
- O Boticário;
- Casas Bahia;
- Sephora.

Critério preservado para fontes agregadoras:
- código plausível;
- publicado;
- validade ativa;
- benefício relevante;
- uso recente (até 72h);
- filtros explícitos contra asset/icon keys.

**Apple e Gaston permanecem monitoradas, mas sem cupom público nesta etapa por falta de evidência forte o suficiente.** Não preencher a página artificialmente com código fraco/antigo.

Produção após a ampliação:
- commit `fde497a2fe22721b91b00495dd94752772dd0f04`;
- deploy `dpl_osoqXmpWHP7GZVoTa1jiQ4BWgxjc`;
- status READY;
- nenhum erro de runtime encontrado na varredura de 30 minutos após a publicação.

### Changelog Black Friday
- **14/11/2026** — ampliado o radar para cafés, GoCase, brinquedos e varejo/eletro; fontes oficiais Nespresso e GoCase e extração de padrões explícitos de cupom;
- **14/11/2026** — adicionadas fontes diretas de Netshoes/Centauro/Boticário/Casas Bahia/Sephora; validação no ambiente confirmou códigos estruturados e o filtro de asset/icon keys foi ampliado antes da liberação.
- **14/11/2026** — faixa Black Friday da home ampliada para maior visibilidade; radar ficou mais conservador em ofertas com múltiplos percentuais e Samsung foi validada como segunda marca com códigos estruturados e uso recente.
- **14/11/2026** — criada Central Black Friday e radar de cupons com inclusão de marcas não parceiras para tráfego, critérios fortes de validação, rechecagem automática e rastreamento de cliques.

## 6. Integrações e parceiros

### Mercado Livre
Status: ativo.

**Decisão operacional fixa (reconfirmada em 14/11/2026): o lançamento/cadastro de produtos do Mercado Livre é MANUAL.**
Motivo: a automação de produtos do Mercado Livre apresentou dificuldades recorrentes e não deve ser reativada nem tratada como obrigação do pipeline sem decisão explícita do Gabriel.
Isso é diferente do monitor de preços dos produtos já cadastrados, que pode continuar conforme as regras atuais e deve ignorar produtos marcados como manuais.

Integrações registradas/históricas:
- Produtos — lançamento manual
- Cupons V2 — automação pausada quando sessão expirada
- Monitor de preços — ativo para itens elegíveis, respeitando produtos manuais

Pontos importantes:
- houve publicação segura do Mercado Livre V2;
- links afiliados são parte obrigatória do fluxo publicado;
- existem tokens ML no Supabase;
- monitor passou por várias correções de timeout e estabilidade;
- em novembro de 2026, produtos Mercado Livre também podem existir como **manuais**;
- produtos manuais devem persistir como manuais;
- preço manual pode ser exibido em cards e reviews;
- data/hora da atualização manual é mostrada em fuso de Brasília;
- o monitor automático deve ignorar produtos manuais.

Pendência cadastrada no banco:
- cobertura remota do monitor ainda incompleta para todos os formatos de link.

### Amazon
Status: ativo.

Estado auditado em 14/11/2026:
- rede: Amazon Associados;
- 4 produtos ativos cadastrados na tabela `produtos`;
- todos possuem link afiliado;
- 0 ofertas Amazon em `economize_ofertas`;
- 0 cliques humanos registrados nos 4 produtos no momento da auditoria;
- não havia credenciais/configuração de Creators API identificadas nas variáveis do projeto Vercel.

#### Decisão operacional temporária — Amazon restaurada
Em 14/11/2026, por decisão operacional, os produtos Amazon foram **restaurados ao comportamento anterior** enquanto a prioridade do projeto passa a ser a Central Black Friday.

Estado temporário:
- imagem real volta a ser exibida;
- preço atual e preço anterior voltam a ser exibidos;
- avaliação, parcelamento e frete voltam a aparecer quando existirem;
- link afiliado continua funcionando;
- os 4 produtos existentes voltam a `monitoramento_manual=false`;
- monitor automático da Amazon volta ao comportamento anterior;
- preparação automática por link Amazon volta ao comportamento anterior;
- a Creators API permanece documentada e preparada, mas estacionada por enquanto;
- retomar Creators API quando a conta Amazon cumprir os requisitos de elegibilidade.

Essa decisão é temporária e deve ser reavaliada quando o acesso oficial da Creators API for liberado.

#### Regra operacional Amazon — 14/11/2026
A coleta automática por scraping/Playwright foi **pausada**.

Motivo:
- o monitor e o preparador automático extraíam preço, disponibilidade, imagens, avaliação, parcelamento e frete diretamente das páginas Amazon;
- as políticas atuais do Programa de Associados determinam que preço/disponibilidade exibidos pelo site devem vir de mecanismos autorizados pela Amazon. Em 14/11/2026 a documentação oficial atual foi revisada e o caminho recomendado para novos desenvolvimentos passou a ser a **Creators API**; a antiga PA-API 5.0 está em migração/depreciação;
- conteúdo comercial Amazon não deve continuar sendo tratado como um feed próprio obtido por scraping.

Mudanças aplicadas:
- produtos Amazon existentes passam a `monitoramento_manual=true`;
- qualquer novo produto Amazon cadastrado também é forçado para modo manual;
- o monitor automático ignora Amazon;
- a preparação automática/IA por link Amazon fica bloqueada até Creators API;
- preço antigo/atual, avaliação, vendas, parcelas e frete raspados não são exibidos publicamente;
- imagens raspadas da Amazon deixam de ser exibidas; é usado placeholder local neutro até Creators API;
- CTA passa a orientar `Ver na Amazon` / `Ver preço na Amazon`;
- identificação `Publicidade · link de afiliado Amazon` fica próxima aos links;
- foi adicionada ao site a declaração exigida pelo Programa: `Como associado da Amazon, eu ganho com compras qualificadas.`

Cadastro operacional atualizado:
- integrações: Produtos + Links afiliados;
- automação: parcial;
- scraping automático: pausado;
- próxima integração técnica: Creators API oficial.

Próxima etapa obrigatória:
1. confirmar que a conta Amazon Associados está com **aceitação final** e possui vendas qualificadas;
2. acessar **Portal de Associados → Ferramentas → Creators API** usando o titular principal da conta;
3. criar uma **Application** e gerar **Credential ID + Credential Secret + Version**;
4. configurar essas credenciais diretamente no ambiente seguro da Vercel (nunca registrar segredo em GitHub ou conversa);
5. integrar a Creators API com OAuth 2.0, token em cache e `partnerTag` correto para Amazon Brasil;
6. usar a API oficial para ASIN, título, preço, disponibilidade, imagens e links retornados pela Amazon;
7. somente depois ampliar o catálogo Amazon e avançar para Cupons Amazon V2.

#### Creators API — base técnica preparada
Em 14/11/2026 foi preparada a primeira integração oficial da Amazon Creators API no projeto.

Implementado:
- cliente server-side em `lib/amazon/creatorsApi.ts`;
- OAuth 2.0 via Login with Amazon com cache do access token por ~1h;
- endpoint de token NA para Brasil: `https://api.amazon.com/auth/o2/token`;
- endpoint global da API: `https://creatorsapi.amazon`;
- marketplace fixado por padrão em `www.amazon.com.br`;
- `GetItems` por ASIN, até 10 itens por chamada;
- `SearchItems` por palavras-chave;
- recursos solicitados: título, imagens oficiais, OffersV2/preço, disponibilidade e seller;
- rota administrativa `/api/admin/economize/amazon/creators` protegida por autenticação;
- painel **Amazon Creators API oficial** dentro da Central Economize;
- painel mostra credenciais faltantes sem revelar segredo e permite testar OAuth + GetItems com um ASIN real.

Variáveis seguras esperadas na Vercel:
- `AMAZON_CREATORS_CREDENTIAL_ID`
- `AMAZON_CREATORS_CREDENTIAL_SECRET`
- `AMAZON_CREATORS_CREDENTIAL_VERSION`
- `AMAZON_CREATORS_PARTNER_TAG`
- `AMAZON_CREATORS_MARKETPLACE` é opcional; default `www.amazon.com.br`.

Regra de segurança:
- Credential Secret nunca deve ser enviado por chat nem commitado no GitHub;
- configurar diretamente no Vercel Environment Variables;
- só reativar automação/preço/imagem Amazon depois de OAuth + GetItems passarem no painel.

Pendência:
- **Creators API oficial ainda não configurada**;
- elegibilidade da conta para Creators API foi conferida no Portal de Associados em 14/11/2026;
- o portal mostra que o cadastro ainda **não possui aceitação final** para criar aplicações;
- a documentação exibida pela própria Amazon informa que o acesso à API exige conta aceita e vendas qualificadas;
- para acesso à API de produtos via Creators API, a FAQ informa **pelo menos 10 vendas qualificadas nos últimos 30 dias**;
- apenas o titular principal da conta pode criar a aplicação e gerar as credenciais;
- se já houver as vendas qualificadas, a própria Amazon orienta solicitar aceitação final pelo formulário **Associates Contact Us**, explicando a necessidade de acesso à Creators API;
- **Cupons Amazon V2 ainda não automatizados**.

### AWIN
A AWIN é uma das bases mais importantes do projeto.

Características já implementadas:
- pipeline multiloja;
- Product Feed Enhanced;
- seleção de ofertas com desconto real;
- deeplinks afiliados;
- sincronização com Central Economize;
- rotinas específicas por parceiro;
- proteção para respeitar a loja solicitada;
- monitor-only quando necessário;
- advertiser ID por parceiro;
- exigência de link afiliado.



### Regra permanente para novas lojas AWIN
Ao adicionar uma nova loja AWIN, **não reinventar o pipeline se já existir um fluxo estável que atende o caso**.

Padrão obrigatório:
- copiar/adaptar o modelo de uma loja AWIN já estável e semelhante;
- manter a mesma arquitetura de cron, rota dedicada, Sandbox, status, log, resultado, publicação e watchdog quando aplicável;
- alterar apenas o necessário: slug, advertiser ID, domínio, limites, regras comerciais e particularidades reais do feed;
- preservar as validações já comprovadas de link afiliado, preço, desconto e publicação;
- só criar lógica nova quando o feed/parceiro realmente exigir e houver evidência de que o padrão existente não atende;
- evitar coletores genéricos/multiloja quando uma rota dedicada já se mostrou mais confiável para operação crítica;
- antes de colocar em produção, validar o fluxo ponta a ponta com uma execução real e conferir os dados gravados no Supabase.

Objetivo: reduzir regressões, evitar duplicação desnecessária e replicar o que já funciona no projeto.

### Painel de Saúde AWIN
Em 14/11/2026 foi criado um painel operacional dentro da Central Economize para acompanhar os catálogos AWIN sem criar um sistema paralelo.

O painel reaproveita:
- status real dos coletores já existentes no Vercel Sandbox;
- watchdog;
- contagens reais da tabela `economize_ofertas`;
- cadastro de `afiliados_parceiros`.

Lojas iniciais:
- C&A;
- Nike;
- KaBuM;
- Cobasi;
- Lauri Esporte.

Métricas exibidas:
- saúde atual;
- última execução;
- feeds encontrados/lidos;
- total de produtos no feed;
- produtos elegíveis;
- selecionados para publicação;
- links afiliados válidos;
- novas ofertas;
- ofertas atualizadas;
- expiradas;
- ativos/pendentes/total no banco;
- erro do coletor, quando houver.

O painel também oferece `Executar agora` por loja usando as rotas já existentes. Regra importante: o estado mais recente do coletor prevalece sobre um watchdog antigo, evitando falso vermelho após uma execução bem-sucedida.

Em 14/11/2026 o cadastro interno da Cobasi foi alinhado com a operação real:
- `integracoes = ['Catálogo']`;
- `automacao_status = ativa`;
- pendência removida;
- próximo passo: manter catálogo pet automático e acompanhar saúde/qualidade.



#### C&A
- status: ativo
- catálogo e cupons
- automação: ativa
- comissão cadastrada: 6% CPA

#### KaBuM
- status: ativo
- catálogo, cupons e promoções
- automação: ativa
- pipeline dedicado
- regras específicas de comissão e produtos não comissionáveis cadastradas no banco

#### Nike
- status: ativo
- catálogo
- automação: ativa
- regras de comissão por canal cadastradas no banco

#### Lauri Esporte
- status: ativo
- catálogo, cupons, promoções e links afiliados
- advertiser ID oficial: `118977`
- ganhou destaque na barra de parceiros
- foi adicionada ao sitemap
- regra atual: manter somente ofertas com desconto real (mínimo operacional de 10%)
- **14/11/2026:** diagnosticado catálogo público zerado porque o cron dedicado das 08:40 UTC executou código antigo (`33d809...`) em que `?loja=lauri-esporte` era ignorado; a rotina processava C&A, Renner, Calvin Klein, Stanley, Casas Bahia e Lauri por último, sem publicação Lauri concluída.
- correção: criada rota 100% dedicada `/api/admin/economize/awin/lauri-esporte/produtos/executar`, com `AWIN_PRODUTOS_LOJAS=lauri-esporte`, status/log próprios e cron próprio.
- Lauri passa a ser monitorada também pelo watchdog de catálogo.

#### Renner
- status: ativo
- fonte AWIN configurada
- ainda precisa confirmação de tabela de comissão PF/PJ no cadastro de parceiros

#### Stanley
- status: ativo
- fonte AWIN configurada
- integração/catálogo pode ser expandido

#### Calvin Klein
- status: ativo
- fonte AWIN configurada
- comissão cadastrada: 8% CPA

#### Cobasi
- status: ativo
- parceiro AWIN
- produtos pet foram priorizados em fases recentes
- existe cron dedicado de produtos

#### Decolar
- status: ativo
- AWIN
- integração parcial
- vertical viagens usa lógica própria, além da relação de afiliado

#### Casas Bahia
- status de parceiro: pausado
- fonte AWIN existente porém inativa
- motivo cadastrado: feed/programa indisponível atualmente

### Lomadee
Parceiros cadastrados como ativos/parciais:
- Cacau Show
- Kappesberg
- Mobly
- SHEIN
- Shopee
- TeraByte
- Xiaomi Brasil

Padrão atual:
- link monetizado disponível;
- catálogo nem sempre retornado pela API;
- usar campanhas/cupons quando disponíveis;
- revalidar catálogo periodicamente.

### Outros parceiros/targets cadastrados
- Booking.com
- Adidas
- Azul Viagens
- CVC
- GOL
- Magalu
- Gocase

Esses variam entre alvo, pendente, manual ou ainda não integrado.

---

## 7. Produtos, reviews e monitor

### Tabelas principais
- `produtos`
- `produto_imagens`
- `monitor_execucoes`
- `monitor_alteracoes`

Em 14/11/2026:
- produtos: 70
- imagens: 484
- execuções de monitor: 45
- alterações registradas: 388

### Campos importantes de produtos
Incluem:
- preço antigo/atual;
- desconto;
- loja;
- categoria;
- link e link afiliado;
- imagens;
- avaliação;
- vendas;
- frete;
- `tem_em_casa`;
- opinião do casal;
- nota do casal;
- tempo de uso;
- pontos positivos/negativos;
- review completa;
- vídeo;
- monitoramento e erros;
- campos de review manual;
- data de início de uso;
- horário de atualização manual.

### Reviews do Casal
Em novembro de 2026 foi construída a página **Reviews do Casal**.

Decisões importantes:
- reviews permanecem indexáveis mesmo sem oferta ativa;
- review deve ser separada do estado da oferta;
- CTA afiliado manual pode ser usado;
- link manual de compra pode ser rastreado;
- tempo de uso pode ser calculado automaticamente a partir de data inicial;
- preço manual pode ser exibido;
- horário de atualização manual deve aparecer corretamente em Brasília.

### Monitor automático
Histórico de correções:
- proteção de execução;
- histórico de execuções;
- redução de travamentos por consulta ML;
- tratamento de timeouts;
- prevenção de quarentena indevida;
- página sem cache;
- exclusão de produtos manuais;
- correção final para ignorar produtos manuais.

**Regra permanente:** produto com `monitoramento_manual`/fluxo manual não deve ser sobrescrito pela automação.

---

## 8. Viagens

O vertical Viagens é um produto próprio do site, não apenas uma página de links.

### Estruturas confirmadas
Tabelas:
- `viagens_radares`
- `viagens_execucoes`
- `viagens_precos`
- `viagens_alertas`
- `viagens_pacotes`
- `viagens_ingressos`
- `viagens_ignav_chamadas`
- `viagens_interacoes`

Volumes históricos em 14/11/2026 antes da consolidação final:
- radares: 160
- execuções: 5.733
- preços: 19.219
- chamadas IGNAV: 22.054
- interações: 25

Snapshot após a migração estrutural de 14/11/2026:
- `viagens_pacotes`: 2 registros no momento da conferência;
- `viagens_ingressos`: **0 registros**;
- a contagem de `viagens_pacotes` é operacional e muda conforme ofertas são cadastradas/arquivadas/excluídas.

### Radar Viagens — referências históricas
Metas/regras trabalhadas:
- POA → Nova York até ~R$ 2.400
- POA → Los Angeles até ~R$ 2.500
- POA → Miami até ~R$ 2.300
- POA → Lisboa até ~R$ 4.000
- SP/RJ também passaram a ser suportados
- permanências de 8, 12 e 15 dias, com janela de até 21 dias

Esses valores são referências históricas do produto e podem mudar; não devem ser tratados como preços atuais sem coleta.

### Ofertas flexíveis de viagem
Em 14/11/2026 a estrutura de `viagens_pacotes` foi ampliada sem quebrar os registros existentes.

#### Fonte única de ofertas
Em 14/11/2026 os ingressos deixaram de usar cadastro/tabela pública separada como fonte principal. O histórico existente é migrado para `viagens_pacotes` com `tipo=ingresso`, preservando o mesmo UUID. A URL antiga `/viagens/ingresso/[id]` redireciona permanentemente para `/viagens/pacote/[id]`.

A tabela `viagens_ingressos` permanece apenas como estrutura legada vazia durante a transição e **não deve receber novos cadastros**. Após a migração real, sua contagem foi confirmada em **0 registros**.

Migração versionada:
- `supabase/migrations/20261114134500_viagens_unifica_ingressos_arquivamento.sql`

Caso preservado na migração:
- Beto Carrero World;
- UUID preservado: `d36900cb-bb92-46ee-b3d9-7b6f0c9ba14c`;
- tipo final: `ingresso`;
- status: `ativo`;
- preço total: R$ 124,00;
- preço por pessoa: R$ 124,00;
- link afiliado preservado: `https://tidd.ly/4isMQKG`;
- `arquivado_em = null` após a migração.

#### Arquivamento
- `viagens_pacotes.arquivado_em` indica uma oferta arquivada;
- arquivar **não apaga** a oferta nem muda seu status original;
- ofertas arquivadas saem da vitrine pública, sitemap, monitor e cron;
- o admin continua mostrando a oferta e oferece **Restaurar**;
- exclusão definitiva permanece separada e exige confirmação forte.

#### Saúde unificada das ofertas
Também em 14/11/2026 o monitor de disponibilidade passou a cobrir **todas as modalidades de viagem**:
- pacote;
- hotel;
- ingresso;
- carro;
- cruzeiro;
- passeio;
- outro.

Regras do monitor:
- `pacote`: mantém validação profunda com dados de voo + hotel;
- demais tipos: validação por validade, datas e resposta do link do parceiro;
- bloqueios técnicos do parceiro (ex.: 403/429) viram **erro técnico**, sem inativar automaticamente;
- expiração objetiva por validade/data pode marcar a oferta como indisponível/expirada;
- ingressos da tabela `viagens_ingressos` receberam os mesmos campos de saúde;
- o painel do admin passou a mostrar todos os tipos em uma única tabela;
- a ação padrão de remoção operacional passou a ser **Arquivar**, com restauração posterior;
- a exclusão definitiva continua disponível separadamente e exige confirmação explícita.

Tipos suportados no cadastro flexível:
- `pacote` — aéreo + hotel; mantém Radar, aeroportos, companhia aérea, bagagem, datas e noites;
- `hotel` — hotel + cidade/destino + check-in/check-out + noites; **não exige aeroportos**;
- `ingresso` — atração/local; sem obrigação de voo/hotel;
- `carro` — local de retirada + período; sem passageiros/aeroportos;
- `cruzeiro` — porto/local + período + noites;
- `passeio` — atração/local, com dados comerciais da oferta;
- `outro` — formato genérico para oportunidades que não se encaixam nos anteriores.

Regras:
- registros antigos continuam `tipo=pacote` por padrão;
- URLs existentes de pacote não mudaram;
- link afiliado e preço continuam obrigatórios para publicação/cadastro;
- o formulário do admin mostra e exige somente campos pertinentes à modalidade;
- o verificador automático de disponibilidade Decolar continua atuando **somente em `tipo=pacote`**, para não gerar falsos erros em hotel/carro/cruzeiro/etc.;
- a vitrine pública e a página individual passam a usar rótulo, ícone, local, período e preço conforme o tipo;
- a validade da oferta pode ser cadastrada e remove a oferta da vitrine pública quando expira;
- migration versionada: `supabase/migrations/20261114122000_viagens_ofertas_flexiveis.sql`.

### Pacotes Decolar
O fluxo passou por várias versões:
- fallback Playwright;
- Vercel Sandbox;
- OIDC;
- Chromium serverless;
- Puppeteer;
- captura de rede;
- CDP;
- captura global de targets;
- capturador local;
- integração no admin;
- correções de aeroportos e valores;
- verificador de disponibilidade.

Em novembro de 2026 foram adicionados:
- `impostos_taxas_encargos`
- `preco_total_final`
- captura de taxas e total final;
- destaque do total final;
- composição do total final na interface.

### Regras de publicação de pacotes
- pacote não publicável deve ficar bloqueado inclusive por URL direta;
- sitemap não deve incluir pacote não publicável;
- disponibilidade possui estados próprios e histórico de falhas;
- link afiliado é obrigatório no registro de pacote.

---

## 9. Consultoria, conteúdo e resultados comerciais

### Painel de Performance do Casal
Rota: `/admin/economize/performance`.

Funções atuais:
- meta de 3 vídeos por semana;
- progresso automático via `video_publicado_em`;
- fila de próximos vídeos;
- pautas guiadas por demanda;
- biblioteca de vídeos publicados;
- métricas de cliques humanos, sessões e cliques de review;
- exclusão de bot/admin das métricas principais usando `trafego_tipo = humano_provavel`;
- botão **+ Adicionar à fila** para escolher produtos cadastrados e sem vídeo.

A fila reutiliza `produtos.tem_em_casa`; não foi criado sistema paralelo.

Regra de interpretação:
- `cliquesReview` = cliques de compra em contexto de review; não significa leitores/espectadores únicos;
- sessão não deve ser chamada automaticamente de pessoa única.

### Resultados comerciais
Rota: `/admin/economize/resultados-comerciais`.

Estrutura atual:
- tabela `economize_vendas`;
- vendas confirmadas, pendentes e canceladas;
- valor vendido;
- comissão;
- conversão operacional clique → venda;
- resultado por canal;
- resultado por loja/parceiro;
- cadastro manual enquanto parceiro não fornece integração;
- estrutura preparada para produto, oferta, campanha e ID externo.

Primeira venda real registrada:
- 15/11/2026
- Mercado Livre
- Galão 5L Combustível Speed Power
- valor vendido: R$ 299,90
- comissão: R$ 29,51
- origem: site

A comissão também aparece no bloco **Conversão por canal**.

### Direção comercial
O histórico de acessos, cliques, reviews, vídeos e vendas deve ser usado como prova objetiva para buscar novas parcerias. Próximo produto comercial desejado: **Painel/Mídia Kit para Parceiros**, alimentado por dados reais do site.

## 9. Watchdog e confiabilidade

Tabelas:
- `sistema_watchdog_status`
- `sistema_watchdog_execucoes`

Em 14/11/2026:
- 8 checks de status
- 1.771 execuções registradas

O watchdog existe para detectar problemas e registrar tentativas de recuperação.

---

## 10. Crons atuais da Vercel

Configuração observada em `vercel.json`:

- `/api/admin/economize/agente/executar`
  - `0 3,9,15,21 * * *`
- `/api/admin/economize/awin/kabum/executar`
  - `0 0,6,12,18 * * *`
- `/api/admin/economize/awin/multiloja/executar`
  - `0 1,7,13,19 * * *`
- `/api/admin/economize/awin/produtos/executar`
  - `15 3,9,15,21 * * *`
- `/api/admin/economize/awin/nike/produtos/executar`
  - `30 2,8,14,20 * * *`
- `/api/admin/economize/awin/kabum/produtos/executar`
  - `45 0,6,12,18 * * *`
- `/api/admin/economize/awin/cobasi/produtos/executar`
  - `20 2,8,14,20 * * *`
- `/api/admin/economize/catalogo/revisar`
  - `50 1,7,13,19 * * *`
- `/api/monitor/run`
  - `20 * * * *`
- `/api/admin/viagens/pacotes/verificar`
  - `10 4,16 * * *`
- `/api/admin/watchdog`
  - `5 * * * *`
- `/api/admin/economize/awin/lauri-esporte/produtos/executar`
  - `40 2,8,14,20 * * *`

**Atenção:** horários de cron da Vercel são UTC. Converter para horário local ao interpretar.

---

## 11. SEO e publicação

Pontos já trabalhados:
- **14/11/2026: páginas `/produto/[id]` migradas para renderização no servidor, preservando a galeria interativa em componente cliente isolado.**
- **14/11/2026: metadata dinâmica por produto/review, canonical, Open Graph e Twitter Cards adicionados nas páginas de produto.**
- **14/11/2026: dados estruturados JSON-LD `Product`, `Review` e `BreadcrumbList` adicionados às páginas de produto quando aplicável.**
- **14/11/2026: links internos reforçados com breadcrumb visual, retorno para Reviews do Casal e bloco de reviews relacionadas.**
- **Validação:** preview Vercel READY; produtos 36, 38 e 101 testados com HTTP 200; produção validada em `/produto/36` com conteúdo completo no HTML, `robots=index,follow`, canonical e JSON-LD presentes.
- metadata da Central Economize;
- sitemap;
- **14/11/2026: sitemap enviado/validado manualmente no Google Search Console, como etapa de indexação e acompanhamento do site;**
- **14/11/2026: confirmação manual no Search Console de que `/economize` e `/viagens` já estão indexadas ("O URL está no Google").**
- **14/11/2026: `/reviews` ainda aparece como "Rastreada, mas não indexada no momento"; rastreamento permitido, busca da página com êxito e indexação permitida, sem bloqueio técnico aparente.**
- inclusão de Reviews do Casal;
- reviews inativas continuam indexáveis;
- Lauri Esporte incluída no sitemap;
- pacotes não publicáveis filtrados do sitemap;
- após a unificação, a regra de disponibilidade profunda do sitemap vale somente para `tipo=pacote`;
- ingressos, hotéis, carros, cruzeiros, passeios e outros tipos ativos/válidos/não arquivados não são excluídos do sitemap apenas porque o parceiro bloqueou a checagem automática;
- Beto Carrero validado no sitemap pela URL nova `/viagens/pacote/d36900cb-bb92-46ee-b3d9-7b6f0c9ba14c`, sem duplicar a URL legada;
- canonical e OpenGraph presentes nas páginas públicas principais.

---

## 12. Parceiros cadastrados no banco

O Supabase possui uma camada própria para gestão de afiliados:
- `afiliados_parceiros`
- `afiliados_checklist`

Em 14/11/2026:
- 26 parceiros
- 114 itens de checklist

Essa camada deve ser usada como fonte operacional de:
- rede;
- status;
- comissão;
- integrações;
- automação;
- pendência;
- próximo passo;
- prioridade.

Não manter essas informações somente em conversa.

---

## 13. Histórico de commits-chave

### Novembro/2026
- `14fd7fb` — ajusta sitemap para ofertas de viagem após a unificação
- `c11359d` — consolida correção social, unificação de ingressos e arquivamento reversível
- `1c9b071` — respeita loja solicitada na coleta Awin
- `b5dda8a` — ignora produtos manuais no monitor automático
- `c198855` — mostra composição do total final do pacote
- `2bb7f96` — destaca total final com taxas nos pacotes
- `33d8092` — captura taxas e total final da Decolar
- `3b4816a` — bloqueia pacote não publicável por URL direta
- `3f35a4f` — inclui Lauri e filtra pacotes não publicáveis em SEO
- `4342666` — cria página Reviews do Casal
- `f0e47b1` — inclui Lauri na rotina multiloja AWIN
- `af6eccb` — fixa advertiser ID oficial da Lauri Esporte

### Agosto/2026
- `7ce0987` — varredura de produtos AWIN com Product Feed Enhanced e deeplink
- `562d3ff` — publicação segura do Mercado Livre V2
- `3ad428f` — conecta fontes AWIN à Central Economize
- `9acac32` — corrige cupom e fluxo de afiliado no admin
- vários commits estruturaram o pipeline Decolar com browser automation, rede, CDP, captura local e verificador

### Julho/2026
- criação da Central Economize;
- API;
- página pública;
- admin;
- filtros;
- edição;
- exclusão;
- redirecionamento seguro;
- tracking.

---

## 14. Estado dos parceiros — resumo operacional

### Ativos/fortes
- Mercado Livre
- Amazon
- C&A
- Decolar
- KaBuM
- Lauri Esporte
- Nike
- Renner
- Calvin Klein
- Cobasi
- Stanley
- GOL
- Cacau Show
- Kappesberg
- Mobly
- SHEIN
- Shopee
- TeraByte
- Xiaomi Brasil

### Pendente/alvo/manual
- Booking.com
- Adidas
- Azul Viagens
- CVC
- Magalu
- Gocase

### Pausado
- Casas Bahia

---

## 15. Pontos ainda pendentes / próximos passos

1. Fechar cobertura remota do monitor do Mercado Livre para todos os formatos de link.
2. Confirmar elegibilidade e integrar **Amazon Creators API oficial**; depois implementar/automatizar **Cupons Amazon V2**.
3. Continuar evolução das integrações prioritárias ainda não fechadas.
4. Confirmar comissões/regras que o banco marca como pendentes.
5. Validar continuamente o fluxo ponta a ponta de pacotes Decolar.
6. Manter qualidade dos preços e desconto real das coletas AWIN.
7. Acompanhar a estabilidade da rota social após a correção, sem tratá-la como pendência aberta enquanto não houver nova recorrência.
8. Manter este documento atualizado sempre que houver decisão arquitetural, nova integração, regra de negócio, cron, tabela ou mudança importante.

---

## 16. Procedimento obrigatório para futuras conversas/agentes

Ao retomar o projeto:

1. Ler `docs/ACHADOS_DO_CASAL_MASTER.md`.
2. Consultar os commits mais recentes da `main`.
3. Verificar o deploy de produção atual na Vercel.
4. Se a tarefa tocar dados/integração, conferir o Supabase real.
5. Só então propor ou executar mudanças.
6. Após uma alteração importante, atualizar este arquivo no mesmo ciclo ou logo em seguida.

---

## 17. Observação sobre contexto histórico

O projeto foi desenvolvido ao longo de meses em diversas conversas. Nem toda decisão antiga aparece integralmente em um único chat. Este documento consolida:
- histórico recuperado das conversas;
- estado real do GitHub;
- estado real da Vercel;
- estrutura real do Supabase;
- regras inferidas de commits e dados operacionais.

Quando surgir informação nova e confirmada que contradiga algo aqui, **corrigir o documento em vez de simplesmente ignorá-lo**.

---

## 18. Regra de manutenção deste MASTER

Toda mudança importante deve acrescentar uma nota curta em uma das seções acima ou numa seção de changelog abaixo.

### Changelog do MASTER
- **16/11/2026** — navegação ajustada após feedback: Gamer permanece visível no menu principal da Home; WhatsApp deixou de ocupar espaço no menu secundário e passou a ser um botão flutuante global no canto da tela para entrada no grupo, exibido nas páginas públicas e oculto em rotas administrativas/login/auth.
- **16/11/2026** — pacote de evolução do restante do site: Home reorganizada em quatro pilares (Ofertas, Reviews, Cupons e Viagens), bloco “Testados por nós” com reviews recentes e acesso destacado a Reviews; Instagram/WhatsApp/Gamer viraram acessos secundários. Página Viagens teve o texto de pesquisa sob demanda reescrito em linguagem comercial, removendo referência interna a custo/pausa de radar. Página de produto ganhou bloco “Experiência do Achados” junto da decisão de compra e barra fixa móvel com preço + CTA “Ver oferta”.
- **16/11/2026** — Central Black Friday recebeu melhoria visual sem redesign estrutural: navegação por categorias, bloco “Melhores cupons agora”, botão de compartilhamento em cada cupom, topo simplificado com métricas essenciais e novos selos visuais (NOVO, VERIFICADO, TERMINA HOJE, MAIOR DESCONTO e PARCEIRO/RADAR). O status público também passou a mostrar o total de lojas monitoradas pelo radar.
- **16/11/2026** — expansão ampla do Radar Permanente/Black Friday para preencher lacunas de consumo: supermercados/atacarejos, delivery/alimentação, bebê/infantil, móveis/decoração, ferramentas/materiais, óticas, livros/papelaria, serviços digitais, fitness/suplementos, seguro viagem/eSIM, parques/atrações e ingressos/entretenimento. Foram adicionadas todas as marcas recomendadas, preservando a regra de que monitorar não significa publicar: código, benefício, vigência e evidência continuam obrigatórios.
- **16/11/2026** — radar de aluguel de carros ampliado: além de Localiza, Movida e Rentcars, passaram a ser monitorados Rentalcars.com e Unidas. Objetivo: capturar cupons e campanhas de locação para viagens e divulgação nos grupos, preservando validação de código, vigência e benefício antes da publicação.
- **16/11/2026** — Beach Park reforçado no Radar Permanente/Black Friday: já constava entre as lojas monitoradas e passou a ter fonte oficial prioritária em `https://blackfriday.beachpark.com.br/` e fonte Cuponation direta como complemento. Publicação automática continua exigindo código verificável, benefício relevante, vigência e evidência forte; foco também em divulgação nos grupos e comparação com a cotação-base da viagem de março/2027.
- **16/11/2026** — Decolar incluída com urgência no Radar Permanente de Cupons. A ronda combina página oficial da Black Friday da Decolar com Cuponation direta, prioriza códigos vigentes, aceita percentuais de viagem a partir de 5% quando publicados/validados e mantém revalidação a cada 3h. Primeira ronda isolada: 26 cupons vigentes processados, 14 ativos e 12 pendentes; nenhum preço/produto do site foi alterado.
- **16/11/2026** — piloto oficial de preço Mercado Livre executado nos 7 produtos ativos: `/sale_price` e `/prices` retornaram 403 para todos os anúncios de terceiros; nenhuma alteração de preço foi feita e o ML permanece em monitoramento manual.
- **16/11/2026** — auditoria geral: principais rotas públicas, sitemap e robots validados com HTTP 200; produção auditada em `fa09b8ca` / `dpl_Dd9cssMvP3ifeMAFB6TFoQH4SpoS` READY; janela final de 30 min sem runtime errors/warnings.
- **16/11/2026** — estado operacional consolidado: 18 produtos ativos, 785 ofertas ativas, 126 cupons ativos no instante da auditoria, 4 reviews completas, 2 produtos com vídeo, 1 venda confirmada e R$ 29,51 de comissão.
- **16/11/2026** — Resultados Comerciais consolidado com tabela `economize_vendas`, valor vendido, comissão, conversão por canal/parceiro e primeira venda real de 15/11/2026.
- **16/11/2026** — Performance ampliado com botão `+ Adicionar à fila` para selecionar próximos produtos a gravar.
- **16/11/2026** — radar de cupons tornado permanente; Cobasi, Microsoft Store/Xbox e Nuuvem incluídas; próxima campanha sazonal definida como **Achados de Natal**.
- **16/11/2026** — auditoria registrou ocorrências históricas a acompanhar: JWT `issued at future` intermitente no catálogo, link ML não reconhecido pelo preparador e Ignav HTTP 424 no radar expandido de viagens.
- **16/11/2026** — corrigida categoria do produto 105 (Galão 5L Speed Power) de Tecnologia para Automotivo; imagem continua pendente. Auditoria de grants confirmou RLS bloqueando tabelas sem policy, mas identificou grants legados amplos em parte das tabelas internas para hardening gradual.
- **14/11/2026** — Central Black Friday chegou a 48 cupons ativos públicos; 44 via radar. Novas lojas validadas: Netshoes, Centauro, O Boticário, Casas Bahia e Sephora. Apple/Gaston seguem monitoradas sem publicação até aparecer evidência confiável.
- **14/11/2026** — Amazon restaurada temporariamente ao comportamento anterior por decisão operacional: imagem, preço, condições e link afiliado voltam ao público e os 4 produtos voltam ao monitor automático; Creators API fica estacionada até elegibilidade. Radar Black Friday passa a priorizar fontes oficiais por loja e amplia cobertura para Renner, Nike, Marisa, Apple, Gaston, Amazon, Americanas, Decathlon, Dafiti e Zattini.
- **14/11/2026** — Central Black Friday com radar de cupons reais: aceita marcas parceiras e não parceiras, publica automaticamente apenas códigos com benefício relevante, validade e uso recente, mantém tráfego direto quando não há afiliado e revalida a cada 3h.
- **14/11/2026** — bloqueio real da Amazon confirmado no Portal: Creators API só libera criação de Application após aceitação final da conta e vendas qualificadas; FAQ da própria Amazon informa requisito de pelo menos 10 vendas qualificadas nos últimos 30 dias para acesso à API de produtos. Se as vendas já existirem, solicitar final acceptance via Associates Contact Us.
- **14/11/2026** — base técnica da Amazon Creators API preparada: OAuth 2.0 com cache de token, GetItems, SearchItems, marketplace BR, rota administrativa e painel de diagnóstico na Central Economize; faltam apenas elegibilidade/credenciais oficiais para teste real.
- **14/11/2026** — correção de direção Amazon: documentação oficial atual confirma **Creators API** como caminho atual e migração da PA-API 5.0; próximos passos atualizados para elegibilidade, Application/Credential, OAuth 2.0 e partnerTag oficial antes de reativar preço/imagens automáticos.
- **14/11/2026** — auditoria Amazon: scraping/Playwright de conteúdo comercial pausado; 4 produtos existentes colocados em monitoramento manual; preço/imagens/avaliações/frete/parcelas raspados ocultados da interface; disclosures de afiliado adicionados; próxima etapa definida como Creators API oficial antes de escalar catálogo/Cupons V2.
- **14/11/2026** — criado Painel de Saúde AWIN na Central Economize, reaproveitando coletores, Sandbox, watchdog e Supabase; inclui C&A, Nike, KaBuM, Cobasi e Lauri, métricas operacionais e botão Executar agora. Cadastro da Cobasi alinhado à automação real.
- **14/11/2026** — definida regra permanente para novas lojas AWIN: replicar/adaptar pipelines já estáveis em vez de reinventar a coleta; rota dedicada, cron, status, logs e watchdog devem seguir o padrão comprovado sempre que aplicável.
- **14/11/2026** — diagnosticada vitrine Lauri em 0/0/—: cron das 08:40 UTC usava coletor antigo `33d809...` e ignorava o filtro de loja, deixando Lauri por último numa varredura multiloja pesada. Criada rota/cron dedicado para Lauri e adicionado check específico no watchdog.
- **14/11/2026** — pós-validação final: produção em `14fd7fb` / deploy `dpl_EK8LgBhDHN3FVc4AESdUA58nX5kA` READY; erro social marcado como resolvido após testes PNG 200 e zero runtime errors; Beto Carrero confirmado na fonte unificada com mesmo UUID/preço/link; `viagens_ingressos` confirmado com 0 registros; sitemap corrigido para aplicar disponibilidade profunda somente a pacotes; PRs #33 e #34 registrados.
- **14/11/2026** — correções estruturais: rota social endurecida para materializar PNG antes da resposta; ingressos migrados para a tabela única de ofertas de viagem preservando IDs/URLs via redirecionamento; arquivamento reversível adicionado com restauração no admin e exclusão definitiva mantida como ação separada.
- **14/11/2026** — monitor de disponibilidade ampliado para todas as ofertas de viagem, com regras próprias por modalidade e painel unificado de saúde/exclusão.
- **14/11/2026** — Viagens ampliado para ofertas flexíveis: pacote, hotel, ingresso, carro, cruzeiro, passeio e outro; hotel não exige aeroportos; verificador Decolar permanece exclusivo de pacotes; estrutura existente preservada.
- **14/11/2026** — reconfirmado como regra permanente: lançamento de produtos do Mercado Livre é manual; não reativar automação de produtos sem decisão explícita do Gabriel.
- **14/11/2026** — SEO de produtos reforçado: server-side rendering em `/produto/[id]`, metadata dinâmica, Product/Review/Breadcrumb JSON-LD e links internos; commit de produção `32c52e7520c0066aa93191924f7f127182d07546`, deploy `dpl_9n7omXWrHiBkSG1rTLqAQWpAgoma` READY.
- **14/11/2026** — registrado estado de indexação no Search Console: `/economize` e `/viagens` indexadas; `/reviews` rastreada com sucesso, indexação permitida, ainda aguardando entrada no índice.
- **14/11/2026** — registrado que o sitemap do site foi enviado/validado manualmente no Google Search Console.
- **14/11/2026** — criação do documento mestre, consolidação de meses de histórico, arquitetura, integrações, regras, banco, cron, estado de produção e pendências.

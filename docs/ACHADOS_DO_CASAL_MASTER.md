# Achados do Casal — MASTER DO PROJETO

> **FONTE MESTRE / LEITURA OBRIGATÓRIA**
>
> Este arquivo existe para impedir perda de contexto entre chats, agentes, sessões e meses de desenvolvimento.
> Antes de alterar o Achados do Casal, leia este arquivo, confira os commits mais recentes da `main`, o estado do deploy de produção e, quando a mudança tocar dados, o estado real do Supabase.
>
> **Última consolidação:** 14/11/2026
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

## 3. Estado de produção em 14/11/2026

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

Integração registrada:
- Produtos

Automação atual no cadastro de parceiros: manual.

Pendência registrada:
- **Cupons Amazon V2 ainda não automatizados.**

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

### Parceiros AWIN relevantes

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
- automação: ativa
- advertiser ID oficial foi fixado
- passou a fazer parte da rotina multiloja
- ganhou destaque na barra de parceiros
- foi adicionada ao sitemap
- regra atual: manter somente ofertas com desconto real

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
- `/api/admin/economize/awin/produtos/executar?loja=lauri-esporte`
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
2. Implementar/automatizar **Cupons Amazon V2**.
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
- **14/11/2026** — pós-validação final: produção em `14fd7fb` / deploy `dpl_EK8LgBhDHN3FVc4AESdUA58nX5kA` READY; erro social marcado como resolvido após testes PNG 200 e zero runtime errors; Beto Carrero confirmado na fonte unificada com mesmo UUID/preço/link; `viagens_ingressos` confirmado com 0 registros; sitemap corrigido para aplicar disponibilidade profunda somente a pacotes; PRs #33 e #34 registrados.
- **14/11/2026** — correções estruturais: rota social endurecida para materializar PNG antes da resposta; ingressos migrados para a tabela única de ofertas de viagem preservando IDs/URLs via redirecionamento; arquivamento reversível adicionado com restauração no admin e exclusão definitiva mantida como ação separada.
- **14/11/2026** — monitor de disponibilidade ampliado para todas as ofertas de viagem, com regras próprias por modalidade e painel unificado de saúde/exclusão.
- **14/11/2026** — Viagens ampliado para ofertas flexíveis: pacote, hotel, ingresso, carro, cruzeiro, passeio e outro; hotel não exige aeroportos; verificador Decolar permanece exclusivo de pacotes; estrutura existente preservada.
- **14/11/2026** — reconfirmado como regra permanente: lançamento de produtos do Mercado Livre é manual; não reativar automação de produtos sem decisão explícita do Gabriel.
- **14/11/2026** — SEO de produtos reforçado: server-side rendering em `/produto/[id]`, metadata dinâmica, Product/Review/Breadcrumb JSON-LD e links internos; commit de produção `32c52e7520c0066aa93191924f7f127182d07546`, deploy `dpl_9n7omXWrHiBkSG1rTLqAQWpAgoma` READY.
- **14/11/2026** — registrado estado de indexação no Search Console: `/economize` e `/viagens` indexadas; `/reviews` rastreada com sucesso, indexação permitida, ainda aguardando entrada no índice.
- **14/11/2026** — registrado que o sitemap do site foi enviado/validado manualmente no Google Search Console.
- **14/11/2026** — criação do documento mestre, consolidação de meses de histórico, arquitetura, integrações, regras, banco, cron, estado de produção e pendências.

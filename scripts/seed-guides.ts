import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { guideArticlesTable } from "../lib/db/src/schema/guide-articles";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const articles = [
  {
    slug: "o-que-e-uma-licitacao",
    title: "O que é uma licitação?",
    description: "Entenda de forma simples como o governo compra produtos e serviços — e como sua empresa pode vender.",
    category: "para-comecar",
    readingTime: 3,
    icon: "Building2",
    orderInCategory: 1,
    content: `## O que é uma licitação?

Licitação é o processo que o governo usa para comprar qualquer coisa: caneta, computador, serviço de limpeza, obra, consultoria. Em vez de simplesmente escolher quem quer, o poder público é **obrigado por lei** a abrir uma competição — e quem oferecer a melhor proposta (geralmente o menor preço) ganha o contrato.

> **Em resumo:** licitação é uma concorrência organizada onde sua empresa pode vender para o governo.

## Por que isso existe?

Para garantir que o dinheiro público seja gasto de forma transparente, sem favorecimentos. Toda licitação é pública — qualquer pessoa pode acompanhar.

## Quem pode participar?

Qualquer empresa com CNPJ ativo e documentação em dia. MEI, microempresas e pequenas empresas têm **vantagens especiais** (veja o artigo sobre a LC 123/2006).

## Como funciona na prática?

- O órgão público publica um **edital** com tudo que precisa comprar
- Empresas interessadas preparam e enviam suas propostas
- Na sessão de disputa, os preços são reduzidos em tempo real
- Quem oferecer o menor preço (na maioria dos casos) vence
- O vencedor assina o contrato e entrega o produto ou serviço

## Onde ficam publicadas as licitações?

O principal portal é o **PNCP** (Portal Nacional de Contratações Públicas), em pncp.gov.br. Estados e municípios também têm portais próprios.

## Quanto tempo leva?

Da publicação do edital até a assinatura do contrato, o prazo médio é de **30 a 60 dias** para pregões eletrônicos — a modalidade mais comum.`,
  },
  {
    slug: "quem-pode-participar",
    title: "Quem pode participar de uma licitação?",
    description: "MEI, microempresa ou pequena empresa? Veja as regras e as vantagens para quem tem porte menor.",
    category: "para-comecar",
    readingTime: 4,
    icon: "Users",
    orderInCategory: 2,
    content: `## Quem pode participar?

Qualquer empresa com CNPJ ativo pode participar de licitações. Não existe restrição de tempo de abertura, setor ou tamanho — desde que a empresa esteja com a **documentação em dia**.

## E o MEI pode participar?

**Sim.** O Microempreendedor Individual pode participar de licitações normalmente. A única limitação prática é o faturamento anual (R$ 81.000/ano para MEI em 2024), que pode inviabilizar contratos muito grandes. Para contratos compatíveis com seu porte, o MEI compete normalmente — e com vantagens.

## Vantagens para MEI, ME e EPP

A Lei Complementar 123/2006 garante tratamento diferenciado para empresas de menor porte:

**1. Licitações exclusivas**
Compras de até R$ 80.000 por item são reservadas exclusivamente para ME e EPP. Grandes empresas não podem participar.

**2. Empate ficto (desempate favorável)**
Se sua proposta ficar até 10% acima do menor preço (pregão), você tem direito de cobrir a oferta do concorrente maior e vencer.

**3. Prazo para regularizar pendências fiscais**
Se vencer com alguma certidão vencida, você tem **5 dias úteis** para regularizar antes de ser desclassificado.

**4. Subcontratação obrigatória**
Em alguns contratos maiores, a empresa vencedora é obrigada a subcontratar ME ou EPP para parte do serviço.

## O que preciso ter em dia?

- CNPJ ativo
- Certidões negativas (federal, estadual, municipal, FGTS, trabalhista)
- Cadastro no SICAF (para licitações federais)
- Conta no portal da licitação (ComprasNet, BLL, etc.)

## Existe restrição por setor?

Não. Empresas de qualquer setor podem participar — desde que o objeto licitado seja compatível com a atividade da empresa.`,
  },
  {
    slug: "como-funciona-pregao-eletronico",
    title: "Como funciona o pregão eletrônico?",
    description: "A modalidade mais comum de licitação explicada passo a passo, do edital ao contrato.",
    category: "para-comecar",
    readingTime: 5,
    icon: "Monitor",
    orderInCategory: 3,
    content: `## O que é o pregão eletrônico?

É a modalidade de licitação **mais usada no Brasil** para compra de bens e serviços comuns. Tudo acontece pela internet — da proposta à disputa de lances.

## Passo a passo completo

### 1. Publicação do edital
O órgão publica o edital no PNCP e na plataforma de licitação (ComprasNet, BLL, Licitanet, etc.). O edital contém tudo: o que será comprado, as exigências, os prazos e as regras.

### 2. Período de propostas
Empresas interessadas cadastram suas propostas na plataforma dentro do prazo (geralmente **8 dias úteis** após a publicação).

### 3. Sessão de disputa (o leilão)
Na data e hora marcadas, o pregoeiro abre as propostas e inicia a fase de lances. As empresas dão lances em tempo real pela internet, reduzindo o preço. Funciona como um **leilão invertido** — quem oferece o menor preço avança.

> **Dica:** fique atento ao horário da sessão. Atrasos de segundos podem fazer você perder a chance de dar um lance.

### 4. Negociação
Após os lances, o pregoeiro pode negociar diretamente com o primeiro colocado para tentar baixar ainda mais o preço.

### 5. Habilitação
O vencedor provisório precisa apresentar os documentos de habilitação (certidões, atestados, etc.) para comprovar que a empresa está apta a contratar.

### 6. Recursos
Outros participantes têm prazo para entrar com recurso se discordarem da decisão.

### 7. Homologação e contrato
Após resolução de recursos, o órgão homologa o resultado e convoca o vencedor para assinar o contrato.

## Quanto tempo dura a sessão?

Depende do número de participantes, mas sessões típicas duram entre **30 minutos e 2 horas**.

## Preciso estar presente?

Não fisicamente — mas precisa estar **online e acompanhando a sessão** pelo sistema da plataforma durante toda a disputa.`,
  },
  {
    slug: "documentos-necessarios",
    title: "Quais documentos sua empresa precisa ter?",
    description: "A lista completa dos documentos básicos: o que é cada um, onde conseguir e por quanto tempo valem.",
    category: "documentos",
    readingTime: 6,
    icon: "FolderCheck",
    orderInCategory: 1,
    content: `## Documentos de habilitação

Para participar de uma licitação, sua empresa precisa comprovar que está regular. Os documentos exigidos variam por edital, mas existe um conjunto básico presente em quase todas as licitações.

## Certidões obrigatórias na maioria dos editais

### CND Federal (Certidão Negativa de Débitos Federais)
- **O que é:** comprova que sua empresa não tem dívidas com a Receita Federal nem com a PGFN
- **Onde emitir:** solucoes.receita.fazenda.gov.br
- **Validade:** 180 dias | **Custo:** gratuito

### CRF — Certificado de Regularidade do FGTS
- **O que é:** comprova que sua empresa está em dia com o FGTS dos funcionários
- **Onde emitir:** consulta-crf.caixa.gov.br
- **Validade:** 30 dias | **Custo:** gratuito

### CNDT — Certidão Negativa de Débitos Trabalhistas
- **O que é:** prova que sua empresa não tem condenações trabalhistas não pagas
- **Onde emitir:** cndt-certidao.tst.jus.br
- **Validade:** 180 dias | **Custo:** gratuito

### Certidão Estadual (SEFAZ)
- **O que é:** comprova regularidade fiscal no estado onde sua empresa é sediada
- **Onde emitir:** site da SEFAZ do seu estado
- **Validade:** 30 a 90 dias (varia por estado) | **Custo:** geralmente gratuito

### Certidão Municipal (ISS)
- **O que é:** comprova regularidade com o município (ISS e outros tributos municipais)
- **Onde emitir:** site da prefeitura do município sede da empresa
- **Validade:** 30 a 180 dias (varia por município) | **Custo:** geralmente gratuito

## Outros documentos frequentes

- **Contrato social** (ou certificado MEI): comprova a existência legal da empresa
- **Cartão CNPJ** (emitido na Receita Federal): dados cadastrais
- **Atestado de capacidade técnica:** comprova que sua empresa já forneceu produto ou serviço similar
- **Balanço patrimonial:** exigido em licitações maiores para comprovar saúde financeira

> **Dica importante:** Organize um cofre digital com todos os documentos e monitore as datas de vencimento. Certidões vencidas são o motivo mais comum de inabilitação — e é completamente evitável.

## Quanto antes, melhor

Emita todas as certidões com antecedência. Algumas podem demorar horas para ficar disponíveis nos sistemas do governo.`,
  },
  {
    slug: "regularidade-fiscal",
    title: "O que é regularidade fiscal?",
    description: "Entenda o que significa estar em dia com a Receita Federal, FGTS e INSS — e como verificar a situação da sua empresa.",
    category: "documentos",
    readingTime: 4,
    icon: "ShieldCheck",
    orderInCategory: 2,
    content: `## O que é regularidade fiscal?

Regularidade fiscal significa que sua empresa **não tem dívidas ativas com o governo** — nem federal, nem estadual, nem municipal. Para participar de licitações, é obrigatório comprovar essa regularidade com certidões negativas.

## Por que isso é exigido?

A Lei 14.133/2021 proíbe o governo de contratar empresas com dívidas tributárias. A lógica é: se a empresa deve ao governo, ela não pode receber dinheiro público.

## Os três níveis de regularidade

**Federal: Receita Federal + PGFN**
Dívidas de IR, CSLL, PIS, COFINS, INSS, parcelamentos, etc.

**Estadual: Secretaria da Fazenda do estado**
Dívidas de ICMS e outros tributos estaduais.

**Municipal: Prefeitura do município**
Dívidas de ISS, IPTU e outros tributos municipais.

**Trabalhista: Justiça do Trabalho**
Condenações trabalhistas com pagamento pendente.

**FGTS: Caixa Econômica Federal**
Contribuições ao Fundo de Garantia não recolhidas.

## Como verificar a situação agora?

Acesse cada portal e consulte pelo CNPJ:

- **Federal:** receitafederal.gov.br
- **FGTS:** consulta-crf.caixa.gov.br
- **Trabalhista:** cndt-certidao.tst.jus.br
- **Estadual e Municipal:** site da SEFAZ/Prefeitura do seu estado/cidade

## E se eu tiver débitos?

Antes de tudo: regularize. **Parcelamentos são aceitos** — uma empresa com débito parcelado e em dia com as parcelas geralmente consegue emitir as certidões.

## O direito especial do MEI e ME

> Se você ganhar uma licitação mas estiver com alguma certidão vencida ou irregular, a Lei Complementar 123 dá **5 dias úteis** para regularizar antes de ser desclassificado. É um direito seu — use-o.`,
  },
  {
    slug: "como-ler-edital",
    title: "Como ler um edital sem se perder?",
    description: "Os pontos mais importantes que você precisa encontrar em qualquer edital antes de decidir participar.",
    category: "processo",
    readingTime: 5,
    icon: "FileSearch",
    orderInCategory: 1,
    content: `## O edital é o contrato antes do contrato

Tudo que valerá na licitação está escrito no edital. Ler com atenção antes de participar evita surpresas desagradáveis depois.

## O que procurar primeiro

### 1. Objeto
O que exatamente está sendo comprado? Verifique se é compatível com o que sua empresa fornece. Atenção ao nível de detalhamento — às vezes o objeto genérico parece simples mas as especificações técnicas são complexas.

### 2. Valor estimado
Quanto o órgão espera pagar? Isso dá a referência para sua proposta. Se o valor estimado for muito abaixo do seu custo real, o processo pode não ser viável.

### 3. Prazo de entrega/execução
Em quanto tempo você precisaria entregar? É factível para sua operação atual?

### 4. Local de entrega
Onde o produto ou serviço precisa ser entregue? Calcule o frete se for fora da sua cidade.

### 5. Exigências de habilitação
Quais certidões e documentos são pedidos? Você já os tem ou precisa providenciar?

### 6. Exigências técnicas
São pedidos atestados de capacidade técnica? Com qual quantidade ou valor mínimo? Você tem esse histórico?

### 7. Datas importantes

- Prazo para envio de propostas
- Data e hora da sessão de disputa
- Prazo para impugnação do edital (se houver algo errado)

### 8. Critério de julgamento
É menor preço? Melhor técnica? Técnica e preço? A maioria dos pregões é **menor preço por item**.

### 9. Forma de pagamento
Em quantos dias o órgão paga após a entrega? Isso afeta seu fluxo de caixa.

## Sinal de alerta: cláusulas restritivas

Fique atento a cláusulas que parecem excluir empresas pequenas:

- Atestados com quantidades atipicamente altas
- Marcas específicas sendo exigidas (ilegal na maioria dos casos)
- Prazos de entrega impossíveis para seu porte
- Capital social mínimo muito alto

> Se encontrar algo assim, você pode entrar com uma **impugnação do edital** antes da sessão.

## Dica prática

Use o LicitaIA para fazer o upload do edital — a IA extrai automaticamente todos esses pontos e monta um checklist para você.`,
  },
  {
    slug: "como-elaborar-proposta",
    title: "Como elaborar uma proposta competitiva?",
    description: "Como calcular seu preço, considerar impostos e montar uma proposta que seja viável e competitiva ao mesmo tempo.",
    category: "processo",
    readingTime: 6,
    icon: "FileText",
    orderInCategory: 2,
    content: `## A proposta é seu cartão de visita

Uma boa proposta equilibra três fatores: cobertura dos seus custos, competitividade frente aos concorrentes e margem de lucro aceitável.

## Passo 1: calcule seus custos reais

Liste tudo que vai custar para entregar o produto ou serviço:

- Custo do produto ou matéria-prima
- Frete e logística
- Embalagem
- Mão de obra (se houver)
- Overhead (energia, aluguel, etc. proporcional)

## Passo 2: inclua os impostos

Esse é o passo que mais gera erro. Sua proposta precisa incluir **todos os impostos incidentes** sobre a venda.

**Se você é MEI:**
MEI é isento de IR, PIS, COFINS e CSLL sobre o faturamento. O imposto é fixo mensal (não percentual). Na prática, a carga tributária do MEI sobre a proposta é muito baixa — isso é uma **vantagem competitiva enorme**.

**Se você é Simples Nacional:**
A alíquota depende do seu faturamento acumulado nos últimos 12 meses e do anexo da atividade. Varia de ~4% a ~22%.

**Se você é Lucro Presumido:**
Carga típica de 11,33% a 16,33% dependendo da atividade.

## Passo 3: defina sua margem mínima

Qual é o mínimo de lucro que faz esse contrato valer a pena? Considere o prazo de pagamento do órgão — se ele paga em 60 dias, você precisa de capital de giro.

## Passo 4: pesquise os preços de mercado

Verifique quanto outros fornecedores cobram pelo mesmo item no PNCP. Propostas muito acima da média de mercado são desclassificadas; muito abaixo levantam suspeita de inexequibilidade.

## Fórmula básica

\`Preço mínimo = (Custo total) ÷ (1 - alíquota de imposto - margem mínima)\`

**Exemplo:**
- Custo: R$ 800
- Imposto: 8% (Simples)
- Margem mínima: 10%
- **Preço mínimo: 800 ÷ (1 - 0,08 - 0,10) = 800 ÷ 0,82 = R$ 975,61**

## Dica sobre a sessão de lances

Sua proposta inicial não precisa ser seu menor preço. Envie um valor um pouco acima e use a sessão de lances para ir reduzindo. Mas **nunca envie abaixo do seu preço mínimo** — contratos com prejuízo são armadilhas difíceis de sair.`,
  },
  {
    slug: "impostos-por-regime",
    title: "Como os impostos afetam sua proposta?",
    description: "Entenda a diferença entre MEI, Simples Nacional, Lucro Presumido e Lucro Real na hora de precificar.",
    category: "financeiro",
    readingTime: 5,
    icon: "Calculator",
    orderInCategory: 1,
    content: `## Por que os impostos importam tanto na proposta?

Porque se você não incluir os impostos no preço, vai pagar eles do seu próprio bolso — e o contrato que parecia lucrativo vira prejuízo.

## MEI — a menor carga

O MEI paga um valor **fixo mensal** independente do faturamento (em torno de R$ 70 a R$ 80/mês em 2024, variando por atividade). Não há percentual sobre o faturamento.

- **Vantagem:** custo tributário previsível e muito baixo
- **Limitação:** faturamento máximo de R$ 81.000/ano. Contratos grandes podem estourar o limite.

## Simples Nacional — alíquotas por faixa

A alíquota varia conforme o faturamento dos últimos 12 meses e o tipo de atividade (comércio, indústria ou serviços).

**Faixas aproximadas:**
- Até R$ 180k/ano: 4% a 6% (comércio) / 6% a 15% (serviços)
- R$ 180k a R$ 360k/ano: 7% a 11% (comércio) / 13% a 18% (serviços)

> Consulte a tabela atualizada do Simples no site da Receita para o valor exato da sua faixa.

## Lucro Presumido — alíquotas fixas por atividade

- Carga típica para comércio: ~11,33%
- Carga típica para serviços: ~14,53% a ~16,33%
- Empresas no Lucro Presumido pagam: IRPJ + CSLL + PIS + COFINS

## Lucro Real — para grandes contratos

Empresas com faturamento acima de R$ 78 milhões/ano são obrigadas ao Lucro Real. Menos comum para ME/EPP.

## Na prática: quem tem mais vantagem?

Para a maioria das licitações de menor valor (até R$ 500k):

- 🥇 **MEI** — menor carga tributária
- 🥈 **Simples Nacional** (faixas iniciais)
- 🥉 **Lucro Presumido**

Isso significa que MEIs e empresas do Simples conseguem oferecer preços menores e ainda ter margem — uma **vantagem competitiva real**.`,
  },
  {
    slug: "lc-123-direitos-mei-me",
    title: "LC 123/2006 — quais são seus direitos como MEI ou ME?",
    description: "A lei que garante tratamento diferenciado para micro e pequenas empresas em licitações. Conheça cada direito.",
    category: "juridico",
    readingTime: 5,
    icon: "Scale",
    orderInCategory: 1,
    content: `## A lei que protege as empresas menores

A Lei Complementar 123/2006 estabelece um regime diferenciado e favorecido para MEI, microempresas (ME) e empresas de pequeno porte (EPP) em licitações públicas. Conhecer essa lei é fundamental — muitos empresários perdem vantagens por não saber que têm direito a elas.

## Direito 1: Licitações exclusivas (art. 48, I)

Compras públicas de **até R$ 80.000 por item** são reservadas exclusivamente para ME e EPP. Empresas grandes não podem participar.

Como usar: verifique o valor estimado por item no edital. Se for até R$ 80.000, grandes fornecedores estão automaticamente excluídos da disputa.

## Direito 2: Empate ficto (art. 44)

Se sua proposta ficar até **10% acima do menor preço** (no pregão) — ou 5% nas outras modalidades — você tem direito de cobrir a oferta do concorrente e vencer o processo.

> **Exemplo:** concorrente ofereceu R$ 1.000. Se sua proposta for de até R$ 1.100 (10% a mais), você pode cobrir o preço de R$ 1.000 e ganhar.

Por que isso existe? Para compensar as desvantagens estruturais das empresas menores frente às grandes.

## Direito 3: Prazo de regularização fiscal (art. 43)

Se você vencer a licitação mas estiver com alguma certidão irregular, tem **5 dias úteis** para regularizar a situação antes de ser desclassificado.

Atenção: esse prazo só vale se a irregularidade for preexistente e você informar ao pregoeiro. Não tente esconder.

## Direito 4: Subcontratação obrigatória (art. 48, II)

Em contratos maiores, o órgão pode exigir que a empresa vencedora (de qualquer porte) subcontrate ME ou EPP para parte do serviço — geralmente entre 25% e 30%.

Se você é ME/EPP: pode ser subcontratado por empresas maiores, abrindo outra fonte de receita via licitações.

## Direito 5: Cota reservada (art. 48, III)

Em licitações de bens divisíveis, até **25% da quantidade** pode ser reservada exclusivamente para ME e EPP, mesmo que o total do contrato seja maior que R$ 80.000.

## O que fazer se o edital não mencionar esses direitos?

Se o edital ignorar as disposições da LC 123 (ex: não prever o empate ficto), você pode entrar com uma **impugnação** antes da sessão, exigindo a correção. É um direito garantido por lei.`,
  },
  {
    slug: "recursos-e-impugnacoes",
    title: "Recursos e impugnações — quando e como usar?",
    description: "Como contestar um edital injusto ou um resultado com o qual você discorda, dentro dos prazos legais.",
    category: "juridico",
    readingTime: 5,
    icon: "MessageSquareWarning",
    orderInCategory: 2,
    content: `## Dois instrumentos diferentes

**Impugnação:** usada **antes da sessão**, para contestar cláusulas do edital que você considera ilegais ou injustas.

**Recurso:** usado **depois da sessão**, para contestar o resultado da disputa.

## Impugnação do edital

### Quando usar?

- O edital exige marca específica sem justificativa
- Prazo de entrega é impossível para empresas do seu porte
- Capital social mínimo exigido é desproporcional
- Atestado técnico tem quantidades que excluem pequenas empresas
- Edital não prevê o empate ficto (direito garantido pela LC 123)
- Qualquer outra cláusula que pareça restritiva ou ilegal

### Qual o prazo?

Até **3 dias úteis antes** da abertura das propostas (Lei 14.133/2021, art. 164)

### Como fazer?

1. Redija um documento formal identificando a cláusula problemática
2. Fundamente com o artigo de lei que está sendo violado
3. Faça o pedido de correção
4. Protocolize na plataforma da licitação ou diretamente no órgão

O órgão é obrigado a responder em até 3 dias úteis. Se a resposta for negativa, pode escalar para o TCU (em licitações federais) ou tribunais de contas estaduais/municipais.

## Recurso pós-sessão

### Quando usar?

- O pregoeiro desclassificou sua proposta de forma incorreta
- Você acredita que o vencedor deveria ter sido inabilitado
- Houve erro no julgamento das propostas

### Qual o prazo?

- **Intenção de recurso:** imediatamente após a sessão
- **Razões do recurso:** 3 dias úteis após a manifestação de intenção
- **Contrarrazões (da parte contrária):** 3 dias úteis após o fim do prazo de razões

## Efeito do recurso

O recurso tem **efeito suspensivo** — o processo fica parado até a decisão. O prazo médio de julgamento é de 5 a 20 dias úteis.

> **Dica prática:** documente tudo durante a sessão — prints da tela, horários dos lances, qualquer irregularidade que observar. Essa documentação é fundamental para fundamentar um recurso.`,
  },
  {
    slug: "faq-primeiros-passos",
    title: "Perguntas frequentes — primeiros passos",
    description: "As dúvidas mais comuns de quem está começando no mundo das licitações públicas.",
    category: "faq",
    readingTime: 7,
    icon: "HelpCircle",
    orderInCategory: 1,
    content: `## Preciso de CNPJ para participar?

**Sim.** Pessoa física não pode participar de licitações públicas. Você precisa ter um CNPJ ativo — mesmo que seja MEI.

## Quanto custa para participar?

**Nada.** A participação em licitações é gratuita. Alguns portais cobram taxa de cadastro (BLL, Licitanet), mas a maioria é gratuita. Nunca pague para ver o edital.

## Preciso de advogado?

Não é obrigatório para participar. MEI e microempresas participam sem representação jurídica na maioria dos casos. Um advogado pode ajudar em situações mais complexas (impugnações, recursos, contratos de grande valor).

## Posso participar sem ter vendido para o governo antes?

Sim. Não há exigência de histórico com o governo. A exigência de atestado técnico, quando existe, pode ser cumprida com vendas para empresas privadas também (depende do que o edital especifica).

## O que é o SICAF?

O Sistema de Cadastramento Unificado de Fornecedores é o cadastro de empresas que vendem para o governo federal. O registro é gratuito e feito pelo ComprasNet. **Sem SICAF, você não pode participar de licitações federais.**

## Posso participar de licitações de outros estados?

Sim. Não há restrição geográfica. Uma empresa de São Paulo pode ganhar uma licitação do Amazonas — mas lembre-se de calcular o frete na proposta.

## O que acontece se eu ganhar e não conseguir entregar?

Você pode sofrer sanções: **multa** (geralmente 10% a 20% do valor do contrato), **suspensão temporária** do direito de licitar (de 6 meses a 3 anos) e, em casos graves, declaração de inidoneidade (impedimento permanente).

## Posso participar de várias licitações ao mesmo tempo?

Sim. Não há limite de quantas licitações você pode acompanhar simultaneamente. Mas gerencie bem — vencer mais de uma ao mesmo tempo pode comprometer sua capacidade de entrega.

## O governo paga em dia?

Depende do órgão. O prazo legal é de até **30 dias** após a entrega e aceite do produto/serviço. Na prática, órgãos federais tendem a pagar dentro do prazo; municípios menores podem atrasar. Pesquise o histórico do órgão antes de participar.

## Onde posso encontrar licitações?

- **PNCP** (pncp.gov.br) — obrigatório para órgãos federais
- **ComprasNet** — licitações federais
- **BLL, Licitanet, BBMNET** — plataformas privadas usadas por estados e municípios
- **Portais estaduais e municipais** — cada ente tem o seu
- **LicitaIA** — consolida oportunidades de várias fontes em um só lugar com match por perfil da empresa`,
  },
];

async function seed() {
  console.log("Seeding guide_articles...");
  for (const article of articles) {
    await db
      .insert(guideArticlesTable)
      .values({ ...article, published: true })
      .onConflictDoUpdate({
        target: guideArticlesTable.slug,
        set: {
          title: article.title,
          description: article.description,
          category: article.category,
          content: article.content,
          readingTime: article.readingTime,
          icon: article.icon,
          orderInCategory: article.orderInCategory,
          published: true,
        },
      });
    console.log(`  ✓ ${article.slug}`);
  }
  console.log("Done!");
  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });

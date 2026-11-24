# Agente local do Mercado Livre

## O que faz
- Mantem um Chrome visivel e um perfil persistente no computador.
- Usa a sessao local do Mercado Livre; cookies e perfil nao sao enviados ao servidor.
- Recebe tarefas autenticadas do Achados do Casal.
- Extrai dados e galeria de produtos e executa a coleta oficial de cupons.
- Envia apenas os resultados ao painel.

## Primeiro uso
1. No painel administrativo, abra Economize > Mercado Livre V2.
2. Na secao Agente local, clique em Parear este computador.
3. Copie o token exibido uma unica vez.
4. No computador, adicione ao .env.local:
   ACHADOS_LOCAL_AGENT_TOKEN=TOKEN_COPIADO
   ACHADOS_LOCAL_AGENT_NAME=PC de casa
   ACHADOS_AGENT_URL=https://achadosdocasal.com.br
5. No terminal, na raiz do projeto, execute:
   npm run ml:agent
6. O Chrome abre. Entre na conta do Mercado Livre normalmente e deixe o agente rodando.
7. O painel deve mostrar o computador como Online.

## Uso diario
- Deixe o terminal do agente aberto e o computador ligado.
- Ao preparar um produto do Mercado Livre, o site tenta primeiro o extrator normal; se nao vier imagem, envia uma tarefa ao Chrome local.
- Ao clicar em Executar coleta ML V2, a tarefa vai para o Chrome local.
- O agente pode ser encerrado com Ctrl+C. Ao reiniciar, o perfil persistente continua salvo.

## Seguranca
- O token e exibido apenas uma vez. Guarde-o somente em .env.local.
- Nunca envie token, cookies ou arquivos de sessao por mensagem ou GitHub.
- O perfil local fica em tmp/achados-ml-agent-profile e esta ignorado pelo Git.
- Para remover o acesso, use Revogar no painel. Depois disso, apague ACHADOS_LOCAL_AGENT_TOKEN do .env.local.

## Diagnostico
- Se o painel mostrar Offline, confira se npm run ml:agent esta rodando.
- Se o Mercado Livre mostrar captcha, conclua a verificacao no Chrome local; nao tente automatizar ou contornar o captcha.
- Se uma tarefa falhar, consulte a secao Tarefas recentes no painel.

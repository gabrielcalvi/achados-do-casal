# Extração do Mercado Livre

O preenchimento automático usa o Playwright Worker, não a API `/items` do Mercado Livre.

## Uso local

Abra dois terminais na raiz do projeto.

Terminal 1:

```powershell
npm run dev
```

Terminal 2:

```powershell
npm run playwright
```

Na primeira utilização, abra `http://127.0.0.1:4317/login` e faça login no Mercado Livre. A sessão fica salva em `.playwright-profile`.

## Variáveis opcionais

- `PLAYWRIGHT_WORKER_URL`: URL usada pelo Next.js para chamar o worker. Padrão: `http://127.0.0.1:4317`.
- `PLAYWRIGHT_WORKER_PORT`: porta do worker. Padrão: `4317`.
- `PLAYWRIGHT_WORKER_HOST`: host de escuta. Padrão: `127.0.0.1`.
- `PLAYWRIGHT_HEADLESS`: use `true` somente quando não for necessário visualizar o navegador ou fazer login manual.

## Fluxo

1. Colar o link normal do produto.
2. Clicar em **Preparar Produto com IA**.
3. O worker extrai nome, preço, imagem, categoria e URL final.
4. Colar o link de afiliado no campo separado.

const WORKER_URL = "http://127.0.0.1:4317";

export async function extrairMercadoLivreWorker(
  link: string
) {
  const resposta = await fetch(
    `${WORKER_URL}/extrair?url=${encodeURIComponent(link)}`
  );

  const json = await resposta.json();

  if (!resposta.ok || !json.sucesso) {
    throw new Error(
      json.erro || `Worker respondeu ${resposta.status}`
    );
  }

  return json.dados;
}
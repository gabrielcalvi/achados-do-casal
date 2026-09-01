function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contem(texto: string, termos: string[]) {
  return termos.some((termo) => texto.includes(termo));
}

export function categorizarProduto(titulo: string) {
  const texto = normalizar(titulo);

  if (contem(texto, [
    "smartphone", "celular", "iphone", "galaxy s", "galaxy a", "motorola moto", "redmi", "poco ", "xiaomi",
  ])) return "Celulares";

  if (contem(texto, [
    "notebook", "laptop", "placa mae", "placa de video", "processador", "memoria ram", "ssd", "hd ", "mouse", "teclado", "monitor", "impressora", "scanner", "roteador", "modem", "webcam", "gabinete", "fonte atx",
  ])) return "Informática";

  if (contem(texto, [
    "smart tv", "televisor", "soundbar", "caixa de som", "home theater", "fone de ouvido", "headphone", "earbuds",
  ])) return "TV e Áudio";

  if (contem(texto, [
    "tablet", "camera de seguranca", "camera wifi", "camera wi fi", "smartwatch", "relogio inteligente", "echo dot", "chromecast", "fire tv", "streaming box", "drone", "power bank",
  ])) return "Tecnologia";

  if (contem(texto, [
    "ar condicionado", "aspirador", "robo aspirador", "air fryer", "airfryer", "micro ondas", "geladeira", "refrigerador", "freezer", "lavadora de roupas", "lava e seca", "secadora", "cafeteira", "liquidificador", "batedeira", "forno eletrico", "cooktop",
  ])) return "Eletrodomésticos";

  if (contem(texto, [
    "panela", "frigideira", "pote", "hermetico", "marmita", "talher", "faca", "copo", "garrafa", "caneca", "jogo de jantar", "cadeira de escritorio", "mesa", "armario", "estante", "colchao", "travesseiro", "toalha", "cozinha",
  ])) return "Casa e Cozinha";

  if (contem(texto, [
    "furadeira", "parafusadeira", "serra", "esmerilhadeira", "lavadora de alta pressao", "compressor", "chave de impacto", "ferramenta", "maleta de ferramentas",
  ])) return "Ferramentas";

  if (contem(texto, [
    "pneu", "oleo motor", "lubrificante", "aditivo", "limpeza automotiva", "carro", "automotivo", "moto ", "motocicleta", "capacete",
  ])) return "Automotivo";

  if (contem(texto, [
    "lego", "boneca", "boneco", "brinquedo", "carrinho", "hot wheels", "barbie", "nerf", "quebra cabeca", "jogo infantil",
  ])) return "Brinquedos";

  if (contem(texto, [
    "fralda", "bebe", "carrinho de bebe", "cadeirinha", "mamadeira", "chupeta", "berco",
  ])) return "Bebês";

  if (contem(texto, [
    "racao", "petisco", "gato", "cachorro", "cao ", "pet ", "arranhador", "areia sanitaria",
  ])) return "Pet";

  if (contem(texto, [
    "perfume", "eau de toilette", "eau de parfum", "skincare", "protetor solar", "maquiagem", "batom", "mascara capilar", "shampoo", "condicionador", "secador de cabelo", "chapinha",
  ])) return "Beleza";

  if (contem(texto, [
    "whey", "protein", "creatina", "termogenico", "suplemento", "vitamina", "colageno", "omega 3", "melatonina",
  ])) return "Saúde e Bem-estar";

  if (contem(texto, [
    "chuteira", "tenis running", "tenis corrida", "bicicleta", "halter", "academia", "fitness", "musculacao", "bola de futebol", "raquete",
  ])) return "Esportes e Fitness";

  if (contem(texto, [
    "camiseta", "camisa", "calca", "vestido", "jaqueta", "tenis masculino", "tenis feminino", "sandalia", "bolsa", "mochila",
  ])) return "Moda";

  if (contem(texto, [
    "cafe ", "chocolate", "bebida", "alimento", "kit alimentos", "cerveja sem alcool",
  ])) return "Mercado";

  return "Outros";
}

export function ofertaEhProdutoCatalogo(origem: string | null | undefined) {
  const valor = String(origem || "").trim();
  return valor === "agente" || valor.startsWith("agente_produtos_awin_");
}

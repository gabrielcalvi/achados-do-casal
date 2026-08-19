import { supabaseAdmin } from "@/lib/supabase/admin";
import { extrairProduto } from "@/lib/extractor";
import {
  criarSessaoMonitorMercadoLivre,
  type SessaoMonitorMercadoLivre,
} from "@/lib/services/mercadoLivreSandboxMonitor";

type DadosAtuaisMonitor = {
  nome?: string;
  categoria?: string;
  precoAtual: string | number;
  imagem?: string;
  urlFinal?: string;
};

function ehMercadoLivre(produto:
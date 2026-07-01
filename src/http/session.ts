import axios, { AxiosInstance } from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import { BASE_URL, CONSULTA_URL, HTTP_TIMEOUT_MS, USER_AGENT } from "../config";
import { extractViewStateFromHtml } from "./jsf";
import { logger } from "../utils/logger";

export class Session {
  readonly client: AxiosInstance;
  private jar: CookieJar;
  private viewState = "";

  constructor() {
    this.jar = new CookieJar();
    this.client = wrapper(
      axios.create({
        jar: this.jar,
        baseURL: BASE_URL,
        timeout: HTTP_TIMEOUT_MS,
        maxRedirects: 5,
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "es-ES,es;q=0.9",
        },
      })
    );
  }

  getViewState(): string {
    return this.viewState;
  }

  setViewState(value: string | undefined | null): void {
    if (value && value.length > 0) this.viewState = value;
  }

  async init(): Promise<void> {
    logger.info("Iniciando sesion (GET pagina de consulta)...");
    const res = await this.client.get<string>(CONSULTA_URL, {
      responseType: "text",
    });
    const vs = extractViewStateFromHtml(res.data);
    if (!vs) throw new Error("No se pudo extraer el ViewState inicial.");
    this.viewState = vs;
    logger.info("Sesion establecida (JSESSIONID + ViewState).");
  }
}

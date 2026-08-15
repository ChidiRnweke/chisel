import createClient from "openapi-fetch";
import type { paths } from "./schema";

// CORRECT: under BFF mode `src/lib/api/**` classifies as the config layer, and
// config is one of the two places allowed to name the client constructor. The
// client is built once here; everything else imports the type.
export const api = createClient<paths>({ baseUrl: "http://backend" });

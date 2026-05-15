import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });
config({ path: resolve(here, "../.env"), override: true });

const port = Number(process.env.PORT ?? 4000);

createApp().listen(port, () => {
  console.log(`Outlet Validator API listening on ${port}`);
});

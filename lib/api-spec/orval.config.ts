import { defineConfig } from "orval";

export default defineConfig({
  outletValidatorReact: {
    input: "./openapi.yaml",
    output: {
      target: "../api-client-react/src/generated/client.ts",
      client: "react-query",
      mode: "single",
      prettier: false
    }
  },
  outletValidatorZod: {
    input: "./openapi.yaml",
    output: {
      target: "../api-zod/src/generated/schemas.ts",
      client: "zod",
      mode: "single",
      prettier: false
    }
  }
});

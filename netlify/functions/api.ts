import serverless from "serverless-http";
import { createApp } from "../../artifacts/api-server/src/app";

export const handler = serverless(createApp(), {
  basePath: "/.netlify/functions"
});

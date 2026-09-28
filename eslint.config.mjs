import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default [
  { ignores: ["src/generated/**"] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

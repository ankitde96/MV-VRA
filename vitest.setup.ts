// Point at a dedicated test database before any test imports lib/env — keeps integration
// tests (repositories, index sync) from touching the same database `npm run dev`/`db:seed`
// use. Only applies if the environment doesn't already set MONGODB_URI explicitly.
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/mv-vra-test";

import "@testing-library/jest-dom/vitest";

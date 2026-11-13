import { desktopTests } from "./helpers/desktop-tests.mjs";

desktopTests(new URL("../dist/service-worker.js", import.meta.url));

import { desktopTests } from "./helpers/desktop-tests.mjs";

desktopTests(new URL("../build/safari/macos/safari/macos-background.js", import.meta.url));

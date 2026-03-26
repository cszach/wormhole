import { starryNight } from "@/themes/starry-night.js";

import { initShader } from "./shader.js";

const canvas = document.getElementById("bg-shader") as HTMLCanvasElement;
initShader(canvas, starryNight);

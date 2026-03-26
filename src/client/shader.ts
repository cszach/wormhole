import type { Theme } from "@/themes/types.js";

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

type ShaderEngine = {
	setTheme(theme: Theme): void;
};

export function initShader(
	canvas: HTMLCanvasElement,
	initialTheme: Theme
): ShaderEngine | null {
	const gl = canvas.getContext("webgl", {
		alpha: false,
		preserveDrawingBuffer: true
	});

	if (!gl) {
		return null;
	}

	// Enable derivatives for caustics (dFdx/dFdy)
	gl.getExtension("OES_standard_derivatives");

	function compile(type: number, src: string): WebGLShader | null {
		const shader = gl!.createShader(type);

		if (!shader) {
			return null;
		}

		gl!.shaderSource(shader, src);
		gl!.compileShader(shader);

		if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
			console.error("Shader compile:", gl!.getShaderInfoLog(shader));
			gl!.deleteShader(shader);

			return null;
		}

		return shader;
	}

	const vertShader = compile(gl.VERTEX_SHADER, VERT);

	if (!vertShader) {
		return null;
	}

	// Fullscreen quad (shared across all themes)
	const buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
		gl.STATIC_DRAW
	);

	let prog: WebGLProgram | null = null;
	let uTime: WebGLUniformLocation | null = null;
	let uResolution: WebGLUniformLocation | null = null;
	let animId = 0;

	function buildProgram(frag: string): boolean {
		const fragShader = compile(gl!.FRAGMENT_SHADER, frag);

		if (!fragShader) {
			return false;
		}

		if (prog) {
			gl!.deleteProgram(prog);
		}

		prog = gl!.createProgram()!;
		gl!.attachShader(prog, vertShader!);
		gl!.attachShader(prog, fragShader);
		gl!.linkProgram(prog);

		if (!gl!.getProgramParameter(prog, gl!.LINK_STATUS)) {
			console.error("Program link:", gl!.getProgramInfoLog(prog));

			return false;
		}

		gl!.useProgram(prog);

		const aPos = gl!.getAttribLocation(prog, "a_pos");
		gl!.enableVertexAttribArray(aPos);
		gl!.vertexAttribPointer(aPos, 2, gl!.FLOAT, false, 0, 0);

		uTime = gl!.getUniformLocation(prog, "u_t");
		uResolution = gl!.getUniformLocation(prog, "u_res");

		return true;
	}

	function resize(): void {
		const dpr = Math.min(window.devicePixelRatio, 2);
		const scale = dpr * 0.75;

		canvas.width = canvas.clientWidth * scale;
		canvas.height = canvas.clientHeight * scale;
		gl!.viewport(0, 0, canvas.width, canvas.height);
	}

	function startLoop(): void {
		if (animId) {
			cancelAnimationFrame(animId);
		}

		function frame(ms: number): void {
			gl!.uniform1f(uTime, ms * 0.001);
			gl!.uniform2f(uResolution, canvas.width, canvas.height);
			gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
			animId = requestAnimationFrame(frame);
		}

		animId = requestAnimationFrame(frame);
	}

	window.addEventListener("resize", resize);
	resize();

	function setTheme(theme: Theme): void {
		if (buildProgram(theme.frag)) {
			startLoop();
		}
	}

	setTheme(initialTheme);

	return { setTheme };
}

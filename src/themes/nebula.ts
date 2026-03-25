import type { Theme } from "./types.js";

export const nebula: Theme = {
	id: "nebula",
	name: "Nebula",
	frag: `
precision highp float;
uniform float u_t;
uniform vec2 u_res;

float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);

	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));

	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	vec2 shift = vec2(100.0);
	mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));

	for (int i = 0; i < 6; i++) {
		v += a * noise(p);
		p = rot * p * 2.0 + shift;
		a *= 0.5;
	}

	return v;
}

void main() {
	vec2 uv = gl_FragCoord.xy / u_res;
	float aspect = u_res.x / u_res.y;
	vec2 p = vec2(uv.x * aspect, uv.y) * 3.0;
	float t = u_t * 0.04;

	float f1 = fbm(p + vec2(t * 0.3, t * 0.2));
	float f2 = fbm(p + vec2(f1 * 1.5 + t * 0.1, f1 * 1.2));
	float f3 = fbm(p + vec2(f2 * 2.0 - t * 0.15, f2 * 1.8 + t * 0.05));

	vec3 c1 = vec3(0.15, 0.05, 0.25);
	vec3 c2 = vec3(0.35, 0.1, 0.45);
	vec3 c3 = vec3(0.1, 0.25, 0.45);
	vec3 c4 = vec3(0.5, 0.2, 0.55);
	vec3 c5 = vec3(0.05, 0.15, 0.3);

	vec3 col = mix(c1, c2, f1);
	col = mix(col, c3, f2 * 0.7);
	col = mix(col, c4, f3 * f3 * 0.6);
	col = mix(col, c5, smoothstep(0.3, 0.8, f1 * f2));

	col += vec3(0.8, 0.7, 1.0) * smoothstep(0.65, 0.9, f3) * 0.15;

	float stars = step(0.992, hash(floor(gl_FragCoord.xy * 0.5))) * 0.3;
	float twinkle = 0.5 + 0.5 * sin(u_t * (1.0 + hash(floor(gl_FragCoord.xy * 0.5) + 1.0) * 3.0));
	col += stars * twinkle;

	float vig = 1.0 - length(uv - 0.5) * 0.5;
	col *= vig;

	col *= 0.65;

	gl_FragColor = vec4(col, 1.0);
}
`
};

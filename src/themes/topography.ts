import type { Theme } from "./types.js";

export const topography: Theme = {
	id: "topography",
	name: "Topography",
	frag: `
precision highp float;
uniform float u_t;
uniform vec2 u_res;

#extension GL_OES_standard_derivatives : enable

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

float terrain(vec2 p, float t) {
	float h = 0.0;

	for (int i = 0; i < 8; i++) {
		float fi = float(i);
		float seed = fi * 7.13;

		vec2 center = vec2(
			sin(t * 0.13 + seed) * 1.2 + cos(t * 0.07 + seed * 2.0) * 0.8,
			cos(t * 0.11 + seed * 1.5) * 1.0 + sin(t * 0.09 + seed * 0.7) * 0.6
		);

		float spread = 1.5 + sin(t * 0.08 + seed * 3.0) * 0.6;
		float height = 0.3 + 0.2 * sin(t * 0.1 + seed * 2.5);

		vec2 d = p - center;
		h += height * exp(-dot(d, d) / spread);
	}

	h += noise(p * 2.0 + t * 0.1) * 0.08;

	return h;
}

void main() {
	vec2 uv = gl_FragCoord.xy / u_res;
	float aspect = u_res.x / u_res.y;
	vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) * 4.0;
	float t = u_t * 1.5;

	float h = terrain(p, t);
	float slice = 0.25 + sin(t * 0.4) * 0.15;
	float elevation = h - slice;

	float levels = 12.0;
	float scaled = elevation * levels;
	float contour = fract(scaled);

	float lw = fwidth(scaled);
	float line = smoothstep(lw * 1.5, 0.0, contour)
		+ smoothstep(1.0 - lw * 1.5, 1.0, contour);
	line = clamp(line, 0.0, 1.0);
	line *= step(0.0, elevation);

	float majorInterval = 3.0;
	float majorScaled = scaled / majorInterval;
	float majorContour = fract(majorScaled);
	float majorLw = fwidth(majorScaled);
	float majorLine = smoothstep(majorLw * 1.5, 0.0, majorContour)
		+ smoothstep(1.0 - majorLw * 1.5, 1.0, majorContour);
	majorLine = clamp(majorLine, 0.0, 1.0);
	majorLine *= step(0.0, elevation);

	vec3 bg = vec3(0.02, 0.02, 0.04);
	vec3 lineCol = vec3(0.06, 0.13, 0.18);
	vec3 majorLineCol = vec3(0.1, 0.22, 0.28);

	vec3 col = bg;

	col += vec3(0.01, 0.02, 0.03) * step(0.0, elevation) * smoothstep(0.0, 0.5, elevation);

	col = mix(col, lineCol, line * 0.6);
	col = mix(col, majorLineCol, majorLine * 0.8);

	float vig = 1.0 - length(uv - 0.5) * 0.4;
	col *= vig;

	gl_FragColor = vec4(col, 1.0);
}
`
};

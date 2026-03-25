import type { Theme } from "./types.js";

export const starryNight: Theme = {
	id: "starry-night",
	name: "Starry Night",
	frag: `
precision highp float;
uniform float u_t;
uniform vec2 u_res;

float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

float hash1(float p) {
	return fract(sin(p * 127.1) * 43758.5453);
}

float starField(vec2 uv, float scale, float brightness) {
	vec2 grid = floor(uv * scale);
	vec2 local = fract(uv * scale);
	float star = 0.0;

	for (int y = -1; y <= 1; y++) {
		for (int x = -1; x <= 1; x++) {
			vec2 cell = grid + vec2(float(x), float(y));
			float h = hash(cell);

			if (h > 0.6) {
				vec2 starPos = vec2(hash(cell + 0.1), hash(cell + 0.2));
				vec2 diff = (local - starPos) - vec2(float(x), float(y));
				float dist = length(diff);

				float size = 0.02 + hash(cell + 0.3) * 0.03;
				float phase = hash(cell + 0.4) * 6.283;
				float speed = 0.3 + hash(cell + 0.5) * 0.7;
				float twinkle = 0.5 + 0.5 * sin(u_t * speed + phase);

				float glow = smoothstep(size, 0.0, dist);
				star += glow * twinkle * brightness;
			}
		}
	}

	return star;
}

float galaxy(vec2 uv, vec2 center, vec2 size, float angle) {
	vec2 d = uv - center;
	float c = cos(angle);
	float s = sin(angle);
	d = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
	d /= size;
	float dist = length(d);
	return smoothstep(1.0, 0.0, dist) * 0.04;
}

float shootingStar(vec2 uv, float t) {
	float col = 0.0;

	for (int i = 0; i < 3; i++) {
		float fi = float(i);
		float period = 10.0 + fi * 7.0;
		float offset = fi * 3.7;
		float cycle = mod(t + offset, period);
		float life = 0.6 + fi * 0.2;

		if (cycle < life) {
			float progress = cycle / life;

			float seed = floor((t + offset) / period) + fi * 100.0;
			vec2 start = vec2(
				0.2 + hash1(seed) * 0.6,
				0.6 + hash1(seed + 1.0) * 0.35
			);
			vec2 dir = normalize(vec2(
				0.5 + hash1(seed + 2.0) * 0.5,
				-0.3 - hash1(seed + 3.0) * 0.4
			));

			float len = 0.08 + hash1(seed + 4.0) * 0.06;

			vec2 head = start + dir * progress * 0.5;
			vec2 tail = head - dir * len;

			vec2 pa = uv - tail;
			vec2 ba = head - tail;
			float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
			float dist = length(pa - ba * h);

			float fade = h;
			float width = 0.002;
			float streak = smoothstep(width, 0.0, dist) * fade;

			float alpha = sin(progress * 3.14159);
			col += streak * alpha * 0.8;
		}
	}

	return col;
}

void main() {
	vec2 uv = gl_FragCoord.xy / u_res;
	float aspect = u_res.x / u_res.y;
	vec2 auv = vec2(uv.x * aspect, uv.y);

	vec3 col = vec3(0.0);

	float s1 = starField(auv, 80.0, 0.15);
	float s2 = starField(auv + 5.0, 40.0, 0.35);
	float s3 = starField(auv + 10.0, 18.0, 0.7);

	float stars = s1 + s2 + s3;

	vec3 warmStar = vec3(1.0, 0.9, 0.75);
	vec3 coolStar = vec3(0.75, 0.85, 1.0);
	float starTemp = hash(floor(auv * 18.0) + 0.6);
	vec3 starCol = mix(coolStar, warmStar, starTemp);
	col += stars * starCol;

	float slowT = u_t * 0.02;
	col += galaxy(auv, vec2(0.3, 0.7), vec2(0.12, 0.04), 0.5 + slowT)
		* vec3(0.7, 0.8, 1.0);
	col += galaxy(auv, vec2(0.8, 0.3), vec2(0.08, 0.03), -0.3 + slowT * 0.5)
		* vec3(1.0, 0.8, 0.7);
	col += galaxy(auv, vec2(0.5, 0.5), vec2(0.15, 0.05), 1.2 - slowT * 0.3)
		* vec3(0.8, 0.75, 1.0);

	col += vec3(1.0, 0.95, 0.85) * shootingStar(auv, u_t);

	float vig = 1.0 - length(uv - 0.5) * 0.4;
	col *= vig;

	gl_FragColor = vec4(col, 1.0);
}
`
};

import type { Theme } from "./types.js";

export const aurora: Theme = {
	id: "aurora",
	name: "Aurora",
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
	vec2 u = f * f * (3.0 - 2.0 * f);
	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p, int octaves) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 6; i++) {
		if (i >= octaves) break;
		v += a * noise(p);
		p = p * 2.0 + vec2(17.0, 31.0);
		a *= 0.5;
	}
	return v;
}

// Aurora curtain: a vertical band of light that ripples horizontally
float auroraCurtain(vec2 uv, float t, float yBase, float seed) {
	// Horizontal displacement — large slow waves + small fast ripples
	float wave1 = sin(uv.x * 1.5 + t * 0.4 + seed) * 0.08;
	float wave2 = sin(uv.x * 3.0 - t * 0.6 + seed * 2.0) * 0.04;
	float wave3 = sin(uv.x * 7.0 + t * 0.9 + seed * 0.5) * 0.015;
	float noiseWave = (fbm(vec2(uv.x * 2.0 + seed, t * 0.3), 4) - 0.5) * 0.1;

	float yCenter = yBase + wave1 + wave2 + wave3 + noiseWave;

	// The curtain drapes downward from yCenter
	float aboveDist = uv.y - yCenter;

	// Fade above the curtain edge (tight)
	float topFade = smoothstep(0.02, -0.01, aboveDist);

	// Long downward drape with varying intensity
	float drapeLen = 0.2 + fbm(vec2(uv.x * 4.0 + seed, t * 0.2), 3) * 0.25;
	float belowDist = yCenter - uv.y;
	float drape = smoothstep(drapeLen, 0.0, belowDist);

	float curtain = topFade * drape;

	// Vertical streaks — the signature aurora look
	float streaks = fbm(vec2(uv.x * 12.0 + seed, uv.y * 1.5 + t * 0.15), 4);
	streaks = smoothstep(0.3, 0.7, streaks);
	curtain *= 0.4 + streaks * 0.6;

	// Brightness variation along the curtain
	float bright = fbm(vec2(uv.x * 3.0 + t * 0.5 + seed, 0.0), 3);
	bright = smoothstep(0.3, 0.8, bright);
	curtain *= 0.3 + bright * 0.7;

	return curtain;
}

void main() {
	vec2 uv = gl_FragCoord.xy / u_res;
	float aspect = u_res.x / u_res.y;
	vec2 auv = vec2(uv.x * aspect, uv.y);

	float t = u_t;
	vec3 col = vec3(0.0);

	// Adapt curtain positions based on aspect ratio
	// On wide screens, lower the curtains so they're more centered
	float ar = u_res.x / u_res.y;
	float yShift = clamp((ar - 1.0) * 0.15, 0.0, 0.2);

	// --- Stars behind the aurora ---
	for (int layer = 0; layer < 2; layer++) {
		float fl = float(layer);
		float scale = 35.0 + fl * 25.0;
		vec2 grid = floor(auv * scale);
		vec2 local = fract(auv * scale);
		float h = hash(grid + fl * 77.0);
		if (h > 0.7) {
			vec2 sp = vec2(hash(grid + 0.1 + fl), hash(grid + 0.2 + fl));
			float dist = length(local - sp);
			float twinkle = 0.5 + 0.5 * sin(t * (0.4 + h * 0.6) + h * 6.28);
			col += vec3(0.8, 0.85, 1.0)
				* smoothstep(0.02, 0.0, dist) * twinkle * 0.4;
		}
	}

	// --- Aurora curtains ---
	// Positions shift down on wide screens so aurora stays centered

	float c1 = auroraCurtain(uv, t, 0.72 - yShift, 0.0);
	float c2 = auroraCurtain(uv, t * 0.85, 0.78 - yShift, 4.5);
	float c3 = auroraCurtain(uv, t * 1.1, 0.65 - yShift, 9.0);
	float c4 = auroraCurtain(uv, t * 0.7, 0.84 - yShift, 14.0);

	// Extra curtain for wide screens to fill more vertical space
	float c5 = auroraCurtain(uv, t * 0.9, 0.50 - yShift, 20.0);

	// Color gradient: green at bottom of curtain, purple/blue at top
	// Based on vertical position relative to curtain
	float heightFactor = smoothstep(0.5, 0.9, uv.y);

	vec3 greenLow = vec3(0.05, 0.9, 0.35);
	vec3 greenBright = vec3(0.15, 1.0, 0.5);
	vec3 teal = vec3(0.05, 0.7, 0.6);
	vec3 purple = vec3(0.4, 0.1, 0.6);
	vec3 deepPurple = vec3(0.2, 0.05, 0.4);

	// Main curtain: vivid green fading to purple at top
	vec3 c1Color = mix(greenBright, purple, heightFactor * 0.8);
	col += c1Color * c1 * 0.22;

	// Second curtain: teal-green
	vec3 c2Color = mix(teal, deepPurple, heightFactor);
	col += c2Color * c2 * 0.15;

	// Third curtain: green
	vec3 c3Color = mix(greenLow, teal, heightFactor * 0.6);
	col += c3Color * c3 * 0.12;

	// Fourth curtain: faint purple fringe at top
	col += deepPurple * c4 * 0.08;

	// Fifth curtain: low green band (more visible on wide screens)
	vec3 c5Color = mix(greenLow, greenBright, 0.3);
	col += c5Color * c5 * 0.1;

	// --- Ambient glow beneath the aurora ---
	float glowY = smoothstep(0.2 - yShift, 0.6 - yShift, uv.y);
	float glowPulse = 0.5 + 0.5 * sin(t * 0.2);
	vec3 ambientGlow = mix(
		vec3(0.02, 0.06, 0.03),
		vec3(0.03, 0.08, 0.04),
		glowPulse
	);
	col += ambientGlow * glowY * (c1 + c2 + c3 + c5) * 0.5;

	// --- Horizon glow ---
	float horizon = smoothstep(0.15, 0.0, uv.y);
	col += vec3(0.02, 0.04, 0.03) * horizon;

	// Vignette
	float vig = 1.0 - length(uv - vec2(0.5, 0.6)) * 0.45;
	col *= vig;

	// Slight overall brightness boost
	col *= 1.3;

	gl_FragColor = vec4(col, 1.0);
}
`
};

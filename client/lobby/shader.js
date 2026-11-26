// Fragment shader of the "scene-lobby" program, which draws the light of the
// lobby's own scenery (the encounter book). Like "scene-toa" it pairs with
// the renderer's scene-effects vertex shader, and a mesh picks its look with
// uniforms.u_animParams = [mode, a, b, c]:
//
//   18 circle  a circle of rings, ticks and a turning star lying on the floor
//   19 motes   sparks rising through a standing sheet. a = half width, b = height
//              (tiles), c = a number that tells one sheet's sparks from another's
//   20 halo    a round light around the point a, b, c, the same from every side.
//              Its mesh is any shape that holds it; normal.x is its radius (tiles)
//
// The circle is a square with normal.x and normal.y from -1 to 1. Motes are
// sheets: normal.x runs from -1 to 1 across, normal.y from 0 to 1 up (toaMesh).
//
// Modes start at 18: the vertex shader animates 1 to 10, "scene-toa" has 11
// to 14, "scene-dt2" 15 to 17.
import { fragmentShaderHead, toaMesh } from "../toa/shader.js";

export const lobbyShaderModes = { circle: 18, motes: 19, halo: 20 };

export const lobbyFragmentShader = fragmentShaderHead + `
uniform mat4 u_viewProjMatrix;

// A thin line where the distance d is zero, in units of the circle's radius.
float stroke(float d) {
  return 1.0 - smoothstep(0.014, 0.034, abs(d));
}

void main() {
  float mode = u_animParams.x;
  float seconds = u_currentTick * 0.6;
  vec3 colour = v_color.rgb;
  float alpha = v_color.a;

  if (mode < 18.5) {
    // Drawn smooth, not in blocks: the lines are thinner than a block.
    vec2 p = v_normal.xy;
    float r = length(p);
    float angle = atan(p.y, p.x);
    // Three rings; between the outer two a scale of ticks, every fourth longer.
    float rings = stroke(r - 0.94) + stroke(r - 0.80) + 0.8 * stroke(r - 0.40);
    float scale = (angle + seconds * 0.04) / 6.2832 * 48.0;
    float longTick = step(mod(floor(scale), 4.0), 0.5);
    float ticks = stroke((fract(scale) - 0.5) / 48.0 * 6.2832 * r) * step(0.82, r) * step(r, mix(0.86, 0.91, longTick));
    // Inside them two squares turn the other way as an eight-pointed star.
    float turn = -seconds * 0.06;
    vec2 q = mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * p;
    float side = 0.78 * 0.7071;
    float star = (stroke(max(abs(q.x), abs(q.y)) - side) + stroke((abs(q.x) + abs(q.y)) * 0.7071 - side)) * step(r, 0.8);
    // A brighter stretch runs around the circle, and the floor glows under it.
    float sweep = 0.65 + 0.35 * sin(angle - seconds * 0.7);
    float breath = 0.85 + 0.15 * sin(seconds * 1.3);
    float glow = 0.22 * exp(-r * r * 3.5) + 0.10 * exp(-pow((r - 0.87) / 0.1, 2.0));
    float lines = clamp(rings + ticks + 0.75 * star, 0.0, 1.0);
    alpha = clamp(lines * sweep * breath * 0.9 + glow, 0.0, 1.0) * (1.0 - smoothstep(0.96, 1.0, r)) * v_color.a;
    colour = mix(colour, vec3(1.0), 0.4 * lines * sweep);
  } else if (mode < 19.5) {
    // Columns two blocks wide; each has its own speed and carries a spark in
    // one of five half-tile cells.
    vec2 block = floor(vec2(v_normal.x * u_animParams.y, v_normal.y * u_animParams.z) * 16.0);
    float column = floor(block.x / 2.0) + u_animParams.w * 57.0;
    float speed = 0.2 + 0.45 * hash(vec2(column, 1.0));
    float rise = block.y / 16.0 - floor(seconds * speed * 16.0) / 16.0 + hash(vec2(column, 2.0)) * 7.0;
    float lit = step(0.93, hash(vec2(column, floor(rise * 2.0))));
    float spark = step(fract(rise * 2.0), 0.13) * step(mod(block.x, 2.0), 0.5);
    float fade = (1.0 - v_normal.y) * smoothstep(0.0, 0.12, v_normal.y);
    alpha = lit * spark * fade * v_color.a;
    colour = mix(colour, vec3(1.0), 0.5);
  } else {
    // The line of sight through this fragment, from the two ends of its
    // pixel's ray; the light is as strong as that line passes near the centre.
    vec4 clip = u_viewProjMatrix * vec4(v_worldPos, 1.0);
    mat4 fromClip = inverse(u_viewProjMatrix);
    vec4 near = fromClip * vec4(clip.xy / clip.w, -1.0, 1.0);
    vec4 far = fromClip * vec4(clip.xy / clip.w, 1.0, 1.0);
    vec3 sight = normalize(far.xyz / far.w - near.xyz / near.w);
    float miss = length(cross(sight, u_animParams.yzw - v_worldPos)) / v_normal.x;
    float core = clamp(1.0 - miss, 0.0, 1.0);
    // The box is drawn front and back, so each face carries half the light.
    alpha = 0.5 * core * core * (0.85 + 0.15 * sin(seconds * 1.3)) * v_color.a;
    colour = mix(colour, vec3(1.0), 0.6 * core * core);
  }

  colour *= u_brightness / 0.6;
  fragColor = vec4(colour, alpha);
}`;

// Collects one mesh for the "scene-lobby" program (see toaMesh).
export const lobbyMesh = (meshId, zIndex, depth, animParams, modelMatrix) =>
  toaMesh(meshId, zIndex, depth, animParams, modelMatrix, "scene-lobby");

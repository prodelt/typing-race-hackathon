/**
 * The hero backdrop: slow folds of red silk over dark steel, drawn by one fragment shader.
 *
 * The brand site renders the same idea with Three.js and a displaced plane; that is 150 KB of
 * library for one background, so this is a single full-screen triangle and a noise function in
 * raw WebGL, a few kilobytes, loaded only after the page is idle (the module is its own chunk and
 * never counts against the initial-JS budget).
 *
 * It is cheap by construction: the canvas renders at a fraction of the CSS size (the folds are
 * soft, so nobody can tell), the loop runs only while the canvas is on screen and the tab is
 * visible, and at `reduced` motion it draws a single still frame. At `off` it is never started:
 * the CSS gradient under it is the whole picture.
 */

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

// Simplex noise: Ashima Arts / Stefan Gustavson, MIT licence.
const FRAGMENT = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime * 0.05;

  // The folds run diagonally, like cloth pinned at the top left and falling to the bottom right.
  float a = 0.9;
  vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
  float n = snoise(vec3(q * 0.8, t));
  float n2 = snoise(vec3(q * 1.6 + 7.0, t * 1.4));
  float fold = q.x * 2.4 + n * 1.25 + n2 * 0.3;
  float wave = sin(fold * 3.0);

  float shade = 0.5 + 0.5 * wave;
  float sheen = pow(max(0.0, wave), 10.0);

  // A red duotone (b-red v4 hero): dark red folds under brand-red silk, gathering to the right.
  float cover = smoothstep(0.05, 1.0, uv.x * 0.8 + (1.0 - uv.y) * 0.35 + n * 0.3);

  vec3 ground = vec3(0.36, 0.047, 0.028);
  vec3 red = vec3(0.761, 0.122, 0.075);
  vec3 deep = vec3(0.30, 0.045, 0.03);
  vec3 silk = mix(deep, red, shade) + vec3(1.0, 0.55, 0.5) * sheen * 0.22;
  vec3 col = mix(ground, silk, cover);
  col *= mix(0.82, 1.0, smoothstep(0.0, 0.6, uv.x));
  gl_FragColor = vec4(col, 1.0);
}
`

export interface HeroShader {
  /** Starts or stops the animation loop. A stopped shader keeps its last frame. */
  setPlaying(playing: boolean): void
  destroy(): void
}

/** The canvas renders at this fraction of its CSS size; the folds are soft enough not to show it. */
const RESOLUTION = 0.5

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (shader === null) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

/**
 * Starts the shader on `canvas`. Returns `null` when WebGL is unavailable or the shader does not
 * compile; the caller then simply keeps the CSS gradient.
 */
export function startHeroShader(canvas: HTMLCanvasElement, playing: boolean): HeroShader | null {
  const gl = canvas.getContext('webgl', {
    antialias: false,
    alpha: false,
    depth: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: false,
  })
  if (gl === null) return null

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  if (vertex === null || fragment === null) return null
  const program = gl.createProgram()
  if (program === null) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
  // biome-ignore lint/correctness/useHookAtTopLevel: a WebGL call, not a React hook
  gl.useProgram(program)

  // One triangle that covers the whole viewport.
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  const uRes = gl.getUniformLocation(program, 'uRes')
  const uTime = gl.getUniformLocation(program, 'uTime')

  // Start mid-drift rather than at zero, so the first frame already looks composed.
  let time = 18
  let last = 0
  let raf = 0
  let wantPlaying = playing
  let visible = true

  const draw = () => {
    gl.uniform2f(uRes, canvas.width, canvas.height)
    gl.uniform1f(uTime, time)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  const resize = () => {
    const width = Math.max(1, Math.round(canvas.clientWidth * RESOLUTION))
    const height = Math.max(1, Math.round(canvas.clientHeight * RESOLUTION))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
    }
    draw()
  }

  const loop = (now: number) => {
    // The first frame after a (re)start only sets the clock; animation time is decorative, so the
    // rAF timestamp is enough and no wall clock is read.
    if (last !== 0) time += Math.min(0.05, (now - last) / 1000)
    last = now
    draw()
    raf = requestAnimationFrame(loop)
  }

  const sync = () => {
    const run = wantPlaying && visible && !document.hidden
    if (run && raf === 0) {
      last = 0
      raf = requestAnimationFrame(loop)
    } else if (!run && raf !== 0) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas)
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true
    sync()
  })
  intersection.observe(canvas)
  document.addEventListener('visibilitychange', sync)

  resize()
  sync()

  return {
    setPlaying(next) {
      wantPlaying = next
      sync()
    },
    destroy() {
      cancelAnimationFrame(raf)
      raf = 0
      resizeObserver.disconnect()
      intersection.disconnect()
      document.removeEventListener('visibilitychange', sync)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

class Particle {
	init!: Particle;

	px: number = 0;
	py: number = 0;
	vx: number = 0;
	vy: number = 0;

	r: number = 50.0;
	lifeTime: number = 5.0;
	dead: boolean = false;
	frac: number = 1.0;

	r_col: number = 0;
	g_col: number = 0;
	b_col: number = 0;

	creationTime: number;
	constructor() {
		this.creationTime = performance.now();
	}
	copy(): Particle {
		let p = new Particle();

		p.px = this.px;
		p.py = this.py;
		p.r = this.r;
		p.vx = this.vx;
		p.vy = this.vy;
		p.lifeTime = this.lifeTime;
		p.dead = this.dead;
		p.frac = this.frac;
		p.r_col = this.r_col;
		p.g_col = this.g_col;
		p.b_col = this.b_col;

		return p;
	}
}

interface ParticleEmitter {
	emit(): number;
}

class EmitterContinuous implements ParticleEmitter {
	creationTime: number;
	particleBuffer = 0;
	duration: number;
	rate: number;
	constructor({ duration = -1, rate = 100 } = {}) {
		this.creationTime = performance.now();
		this.duration = duration;
		this.rate = rate;
	}
	emit(): number {
		if (
			this.duration != -1 &&
			this.creationTime + this.duration <= performance.now()
		)
			return 0;
		this.particleBuffer += this.rate * dt;
		let emissionCount = Math.floor(this.particleBuffer);
		this.particleBuffer -= emissionCount;
		return emissionCount;
	}
}

interface ParticleInitializer {
	init(p: Particle): void;
}

class InitializerTemplate implements ParticleInitializer {
	template: Particle;
	constructor(particle: Particle) {
		this.template = particle;
	}
	init(p: Particle) {
		p.px = this.template.px;
		p.py = this.template.py;
		p.r = this.template.r;
		p.vx = this.template.vx;
		p.vy = this.template.vy;
		p.lifeTime = this.template.lifeTime;

		p.r_col = this.template.r_col;
		p.g_col = this.template.g_col;
		p.b_col = this.template.b_col;

		p.px = mouseX;
		p.py = mouseY;
	}
}

interface ParticleOperator {
	update(p: Particle, dt: number): void;
}

class OperatorMovement implements ParticleOperator {
	gx: number;
	gy: number;
	drag: number;
	constructor({ gx = 0, gy = 0, drag = 0 } = {}) {
		this.gx = gx;
		this.gy = gy;
		this.drag = drag;
	}
	update(p: Particle) {
		p.vx += this.gx * p.frac * dt;
		p.vy += this.gy * p.frac * dt;

		p.vx *= 1 - this.drag * dt;
		p.vy *= 1 - this.drag * dt;

		p.px += p.vx * dt;
		p.py += p.vy * dt;
	}
}

class OperatorLifespan implements ParticleOperator {
	constructor() {}
	update(p: Particle) {
		if (performance.now() - p.creationTime > p.lifeTime) {
			p.dead = true;
		}
	}
}

class OperatorLifeColor implements ParticleOperator {
	r_col: number = 0;
	g_col: number = 0;
	b_col: number = 0;
	constructor(r: number, g: number, b: number) {
		this.r_col = r;
		this.g_col = g;
		this.b_col = b;
	}
	update(p: Particle) {
		let lifeFrac = Math.min((getP().millis() - p.creationTime) / p.lifeTime, 1);
		p.r_col = p.init.r_col + (this.r_col - p.init.r_col) * lifeFrac;
	}
}

interface ParticleRenderer {
	draw(particles: Particle[]): void;
}

let fragSrc = `
// particle.frag
precision mediump float;
varying vec3 vColor;

void main() {
    gl_FragColor = vec4(vec3(0,0,0), 1.0);
}
`;

let vertSrc = `
// particle.vert
attribute vec2 aPosition;
attribute vec3 aColor;

varying vec3 vColor;

void main() {
    vColor = aColor;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;
class RenderSprite implements ParticleRenderer {
	shader: p5.Shader;
	positions: Float32Array;
	colors: Float32Array;

	constructor(maxParticles: number) {
		this.positions = new Float32Array(maxParticles * 2);
		this.colors = new Float32Array(maxParticles * 3);
		this.shader = getP().createShader(vertSrc, fragSrc);
	}

	draw(particles: Particle[]) {
		const p = getP();

		// fill typed arrays
		for (let i = 0; i < particles.length; i++) {
			this.positions[i * 2] = particles[i].px;
			this.positions[i * 2 + 1] = particles[i].py;
			//this.colors[i * 3] = particles[i].r_col / 255;
			//this.colors[i * 3 + 1] = particles[i].g_col / 255;
			//this.colors[i * 3 + 2] = particles[i].b_col / 255;
		}

		p.shader(this.shader);
		// upload to GPU in one call
		this.shader.setUniform("aPosition", this.positions);
		//this.shader.setUniform("uColors", this.colors);
	}
}

class ParticleSystem {
	emitters: ParticleEmitter;
	initializers: ParticleInitializer;
	operators: ParticleOperator[];
	renderers: ParticleRenderer;
	particleList: Particle[];

	constructor(
		emitters: ParticleEmitter,
		initializers: ParticleInitializer,
		operators: ParticleOperator[],
		renderers: ParticleRenderer,
	) {
		this.emitters = emitters;
		this.initializers = initializers;
		this.operators = operators;
		this.renderers = renderers;
		this.particleList = [];
	}
	think() {
		//console.log("thinking");

		let t0 = performance.now();

		let emissionCount = this.emitters.emit();

		let t1 = performance.now();

		//console.log("emitting particle: " + emissionCount);
		let newParticle = [];
		for (let i = 0; i < emissionCount; i++) {
			let fraction = i / emissionCount;
			let p = new Particle();
			p.frac = fraction;
			newParticle.push(p);
		}

		let t2 = performance.now();

		//console.log("initializing");
		newParticle.forEach((p) => this.initializers.init(p));
		newParticle.forEach((p) => {
			p.init = p.copy();
		});
		this.particleList.push(...newParticle);

		let t3 = performance.now();
		//console.log("updating");

		this.operators.forEach((o) => {
			for (let i = 0; i < this.particleList.length; i++) {
				o.update(this.particleList[i]);
			}
		});

		let t4 = performance.now();

		this.particleList = this.particleList.filter((p) => !p.dead);

		let t5 = performance.now();

		this.particleList.forEach((p) => (p.frac = 1));
		//console.log("drawing");
		this.renderers.draw(this.particleList);

		let t6 = performance.now();

		console.log({
			emit: t1 - t0,
			create: t2 - t1,
			initialize: t3 - t2,
			update: t4 - t3,
			filter: t5 - t4,
			draw: t6 - t5,
			total: t6 - t0,
		});
	}
}

const sketch = (p: p5) => {
	setP(p);

	p.windowResized = () => {
		p.resizeCanvas(p.windowWidth, p.windowHeight);
	};

	let ps: ParticleSystem;
	p.setup = () => {
		p.createCanvas(p.windowWidth, p.windowHeight, getP().WEBGL);
		p.noLights();
		let particleTemplate = new Particle();
		particleTemplate.px = 0;
		particleTemplate.py = 0;
		particleTemplate.r = 15;
		particleTemplate.vx = 0;
		particleTemplate.vy = 0;
		particleTemplate.lifeTime = 5000;
		ps = new ParticleSystem(
			new EmitterContinuous({
				duration: -1,
				rate: 10000,
			}),
			new InitializerTemplate(particleTemplate),
			[
				new OperatorMovement({
					gravity: p.createVector(0, 50),
					drag: 0.005,
				}),
				//new OperatorLifeColor(getP().color(255, 0, 0)),
				new OperatorLifespan(),
			],
			new RenderSprite(50000),
		);

		window.ps = ps;
		window.p5 = getP();
	};

	p.draw = () => {
		p.background(220);
		p.resetMatrix();
		p.circle(p.mouseX, p.mouseY, 15);
		ps.think();
	};
};

new p5(sketch);

const canvas = document.createElement("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.body.appendChild(canvas);

const gl = canvas.getContext("webgl")!;

// your own loop
let lastTime = 0;
let dt = 0;
function loop(timestamp: number) {
	dt = Math.min(timestamp - lastTime, 100);
	lastTime = timestamp;

	gl.clearColor(0.86, 0.86, 0.86, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	ps.think();

	requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

window.addEventListener("resize", () => {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	gl.viewport(0, 0, canvas.width, canvas.height);
});

let mouseX = 0;
let mouseY = 0;
canvas.addEventListener("mousemove", (e) => {
	const rect = canvas.getBoundingClientRect();
	mouseX = e.clientX - rect.left;
	mouseY = e.clientY - rect.top;
});

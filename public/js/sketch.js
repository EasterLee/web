class Particle {
	pos;
	r;
	vel;
	lifeTime;
	dead = false;
	constructor() {
		this.creationTime = millis();
	}
}

class ParticleEmitter {
	constructor() {}
	emit(particle) {}
}

class EmitterContinuous extends ParticleEmitter {
	infDuration = false;
	particleBuffer = 0;
	constructor({ duration = -1, rate = 100 } = {}) {
		super();
		if (duration == -1) {
			this.infDuration = true;
		} else {
			this.duration = duration;
		}
		this.rate = rate;
		this.lastEmissionFrame = frameCount;
	}
	emit() {
		if (!this.infDuration && this.duration <= 0) return 0;

		this.emissionPerFrame = this.rate / frameRate();
		this.particleBuffer += this.emissionPerFrame;
		let emissionCount = floor(this.particleBuffer);
		this.particleBuffer -= emissionCount;
		return emissionCount;
	}
}

class ParticleInitializer {
	constructor() {}
	init(particle) {}
}

class InitializerTemplate extends ParticleInitializer {
	constructor(particle) {
		super();
		this.template = particle;
	}
	init(p) {
		p.pos = this.template.pos.copy();
		p.r = this.template.r;
		p.vel = this.template.vel.copy();
		p.lifeTime = this.template.lifeTime;

		p.pos = createVector(mouseX, mouseY);
	}
}

class ParticleOperator {
	constructor() {}
	update(particle) {}
}

class OperatorMovement extends ParticleOperator {
	constructor({ gravity = createVector(0, 0), drag = 0 } = {}) {
		super();
		this.gravity = gravity;
		this.drag = drag;
	}
	update(p) {
		p.vel.add(p5.Vector.mult(this.gravity, deltaTime / 1000));
		p.vel.sub(p5.Vector.mult(p.vel, this.drag));
		p.pos.add(p.vel);

		if (millis() - p.creationTime > p.lifeTime) {
			p.dead = true;
		}
	}
}
class ParticleRenderer {
	constructor() {}
	draw(particle) {}
}

class RenderSprite extends ParticleRenderer {
	constructor() {
		super();
	}
	draw(particle) {
		strokeWeight(particle.r);
		point(particle.pos);
	}
}

class ParticleSystem {
	constructor(emitters, initializers, operators, renderers) {
		this.emitters = emitters;
		this.initializers = initializers;
		this.operators = operators;
		this.renderers = renderers;
		this.particleList = [];
	}
	think() {
		//console.log("thinking");
		let emissionCount = this.emitters.emit();

		console.log("emitting particle: " + emissionCount);
		let newParticle = [];
		for (let i = 0; i < emissionCount; i++) {
			newParticle.push(new Particle());
		}

		//console.log("initializing");
		newParticle.forEach((p) => this.initializers.init(p));
		this.particleList.push(...newParticle);

		//console.log("updating");
		this.particleList.forEach((p) => this.operators.update(p));
		this.particleList = this.particleList.filter((p) => !p.dead);

		//console.log("drawing");
		this.particleList.forEach((p) => this.renderers.draw(p));
	}
}

var ps;
function setup() {
	createCanvas(windowWidth, windowHeight);
	let particleTemplate = new Particle();
	particleTemplate.pos = createVector(0, 0);
	particleTemplate.r = 15;
	particleTemplate.vel = createVector(0, 0);
	particleTemplate.lifeTime = 5000;
	ps = new ParticleSystem(
		new EmitterContinuous({
			duration: -1,
			rate: 1000,
		}),
		new InitializerTemplate(particleTemplate),
		new OperatorMovement({
			gravity: createVector(0, 50),
			drag: 0.005,
		}),
		new RenderSprite(),
	);
}

function windowResized() {
	resizeCanvas(windowWidth, windowHeight);
}

function draw() {
	background(220);
	circle(mouseX, mouseY, 15);
	ps.think();
}

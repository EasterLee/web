const MAX_Particle = 10000;

struct ParticleSystem {
    particles: array<Particle, MAX_Particle>,
    drawParam: vec2<u32>,
    aliveIdx: array<u32, MAX_Particle>,
}

struct UI {
    resolution: vec2f,
	mouse: vec2f,
};

struct Particle {
    color: vec4f,
    pos: vec2f,
    vel: vec2f,
    radius: f32
};
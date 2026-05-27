const MAX_Particle = 10000;

struct ParticleSystem {
    particles: array<Particle, MAX_Particle>,
    aliveIdx: array<u32, MAX_Particle>,
    drawParam: vec2<u32>,
};

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

struct Stack{
	top_index: atomic<u32>,
	arr: array<u32, MAX_Particle>,
};

struct StackRead{
	top_index: u32,
	arr: array<u32, MAX_Particle>,
};
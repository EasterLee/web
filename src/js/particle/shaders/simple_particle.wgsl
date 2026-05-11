struct UI {
    resolution: vec2f,
	mouse: vec2f,
};

struct Particle {
    color: vec4f,
    pos: vec2f,
    vel: vec2f,
};

struct Stack{
	top_index: atomic<u32>,
	arr: array<u32>,
}

struct ParticleSystem {
    emissionCount: u32,
	active: bool,
};

struct VSOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
    @location(1) radius: f32,
    @location(2) uv: vec2f,
};



@group(0) @binding(0) var<uniform> ui: UI;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(2) var<storage, read> aliveRead: Stack;
@group(0) @binding(3) var<storage, write> aliveWrite: Stack;
@group(0) @binding(4) var<storage, read_write> dead: Stack;
@group(0) @binding(4) var<storage, read_write> newParticle: Stack;
@group(0) @binding(5) var<uniform> ps: ParticleSystem;

@vertex fn vs(
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
) -> VSOutput {

    let p = particles[instanceIndex];

    let verts = array(
        vec2f(-1, 1), //<- top
        vec2f(-1, -1), //left bottom
        vec2f(1, -1), //right bottom
        
        vec2f(1, -1), //right bottom
        vec2f(1, 1), //right top
        vec2f(-1, 1), //left top
    );

    let scaled = verts[vertexIndex] * 500;
    let offset = (scaled + p.pos)/ui.resolution; // 0 <-> 1
    let two = offset * 2; // 0 <-> 1 to 0 <-> 2 space
    let clipSpace = two - 1; // 0 <-> 2 to -1 <-> 1
    let flip = clipSpace * vec2f(1, -1); // flip y


    var vsOut: VSOutput;
    vsOut.position = vec4f(flip, 0.0, 1.0);
    vsOut.color = p.color;
    vsOut.uv = verts[vertexIndex];
    return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
    let dist = dot(vsOut.uv, vsOut.uv);
    if (dist > 1.0) {
        discard;
    }
    return vec4f(1.0, 1.0, 1.0, 1.0);
}

// emissionCount is clamped to dead particle pool count
@compute @workgroup_size(64) fn emit(
	@builtin(global_invocation_id) id: vec3<u32>
){
	if (id.x > ps.emissionCount){
		return;
	}

	// pull from dead stack
	let top = atomicSub(&dead.top_index, 1u);
	let particleIdx = dead.arr[top];

	init(particleIdx);

	// push to alive stack
	top = atomicAdd(&aliveWrite.top_index, 1u);
	aliveWrite[top] = particleIdx;
}

fn init(particleIdx: u32){
	let p = particles[particleIdx];

	p.color = vec4f(1.0, 0.0, 0.0, 1.0);
	p.pos = ui.mouse;
	p.vel = vec2f(1.0, 1.0);

	particle[particleIdx] = p;
}
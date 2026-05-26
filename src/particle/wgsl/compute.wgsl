
@group(0) @binding(0) var<uniform> ui: UI;
@group(0) @binding(1) var<storage, read> ps: ParticleSystem;

// worker num is the emission count
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
//swap aliveRead and aliveWrite

// worker num is the alive particle count
// id is the current particle index in alive stack
@compute @workgroup_size(64) fn operate(
	@builtin(global_invocation_id) id: vec3<u32>
){
	if (id.x >= atomicLoad(&aliveRead.top_index)){
		return;
	}
    let particleIdx = aliveRead.arr[id.x];
    let p = particles[particleIdx];

    // operate on p
    p.pos += p.vel;

    particles[particleIdx] = p;
}
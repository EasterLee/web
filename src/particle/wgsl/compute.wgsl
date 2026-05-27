struct StateStacks {
	aliveRead: Stack,
	aliveWrite: Stack,
	dead: Stack,
}

struct StorageRead{
	emissionCount: vec3<u32>,
}

@group(0) @binding(0) var<uniform> ui: UI;
@group(0) @binding(1) var<storage, read_write> ps: ParticleSystem;
@group(0) @binding(2) var<storage, read_write> states: StateStacks;
@group(0) @binding(3) var<storage, read> storageRead: StorageRead;

// worker num is the emission count
// emissionCount is clamped to dead particle pool count
@compute @workgroup_size(64) fn emit(
	@builtin(global_invocation_id) id: vec3<u32>
){
	let _ui = ui;
	let _ps = ps;

	if (id.x > storageRead.emissionCount.x){
		return;
	}

	// pull from dead stack
	var top = atomicSub(&states.dead.top_index, 1u);
	let particleIdx = states.dead.arr[top];


	// push to alive stack
	top = atomicAdd(&states.aliveWrite.top_index, 1u);
	states.aliveWrite.arr[top] = particleIdx;
}

// fn init(particleIdx: u32){
// 	let p = particles[particleIdx];

// 	p.color = vec4f(1.0, 0.0, 0.0, 1.0);
// 	p.pos = ui.mouse;
// 	p.vel = vec2f(1.0, 1.0);

// 	particle[particleIdx] = p;
// }
//swap aliveRead and aliveWrite

// worker num is the alive particle count
// id is the current particle index in alive stack
// @compute @workgroup_size(64) fn operate(
// 	@builtin(global_invocation_id) id: vec3<u32>
// ){
// 	if (id.x >= atomicLoad(&aliveRead.top_index)){
// 		return;
// 	}
//     let particleIdx = aliveRead.arr[id.x];
//     let p = particles[particleIdx];

//     // operate on p
//     p.pos += p.vel;

//     particles[particleIdx] = p;
// }
@group(0) @binding(0) var<storage, read_write> ps: ParticleSystem;
@group(0) @binding(1) var<storage, read_write> currAlive: Stack;
@group(0) @binding(2) var<storage, read_write> nextAlive: Stack;
@group(0) @binding(3) var<storage, read_write> dead: Stack;


// worker num is the alive particle count
// id is the current particle index in alive stack
@compute @workgroup_size(64) fn operate(
	@builtin(global_invocation_id) id: vec3<u32>
){

	// limit worker to number of alive particles
	if (id.x < atomicLoad(&currAlive.top_index)){
		let particleIdx = currAlive.arr[id.x];
		var p = ps.particles[particleIdx];

		// operate on p
		p.pos += p.vel;
		p.lifetime -= 1.0;
		ps.particles[particleIdx] = p;

		if (p.lifetime <= 0) {
			// dead
			stackPush(&dead, particleIdx);
		} else {
			// survived
			// rebuild alive B stack
			stackPush(&nextAlive, particleIdx);
		}
	}
}
// set draw parameter
// make sure to swap alive stack after
@compute @workgroup_size(64) fn post_operate(
	@builtin(global_invocation_id) id: vec3<u32>
){
	atomicStore(&currAlive.top_index, 0u);

	// tell renderer how many particles survived
	var particleCount = atomicLoad(&nextAlive.top_index);
	ps.param.instance_count = particleCount;
}
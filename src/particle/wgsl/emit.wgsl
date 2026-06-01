
@group(0) @binding(0) var<storage, read_write> ps: ParticleSystem;
@group(0) @binding(1) var<storage, read_write> storageRead: StorageRead;
@group(0) @binding(2) var<storage, read_write> alive: Stack;
@group(0) @binding(3) var<storage, read_write> dead: Stack;
@group(0) @binding(4) var<uniform> ui: UI;
	
	
// worker num is the emission count
// emissionCount is clamped to dead particle pool count
@compute @workgroup_size(64) fn emit(
	@builtin(global_invocation_id) id: vec3<u32>
){
	// skip excessive worker
	if (id.x < storageRead.emissionCount){
		// pull from dead stack
		let particleIdx = stackPop(&dead);


		init(particleIdx, ps.last_id+id.x);

		// push to alive stack
		stackPush(&alive, particleIdx);
	}

}

@compute @workgroup_size(1) fn post_emit(
	@builtin(global_invocation_id) id: vec3<u32>
){
	ps.last_id = ps.last_id + storageRead.emissionCount;
	storageRead.computeParam.x = u32(ceil(f32(atomicLoad(&alive.top_index)) / 64f));
}

fn init(particleIdx: u32, id: u32){

	var p = ps.particles[particleIdx];

	p.color = vec4f(1.0, 0.0, 0.0, 1.0);
	p.pos = ui.mouse;
	p.vel = vec2f(cos(f32(id)), sin(f32(id))) * 0.5;
	p.lifetime = 1000.0;
	p.id = id;

	ps.particles[particleIdx] = p;
}


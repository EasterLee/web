const MAX_Particle = 100000;

struct DrawIndirect {
    vertex_count:    u32,  // or index_count
    instance_count:  u32,  // ← this is your stack.top
    first_vertex:    u32,
    first_instance:  u32,
}

struct ParticleSystem {
    particles: array<Particle, MAX_Particle>,
    param: DrawIndirect,
    last_id: u32,
};

struct UI {
    resolution: vec2f,
	mouse: vec2f,
    frame: u32,
    time: f32,
};

struct Particle {
    color: vec4f,
    pos: vec2f,
    vel: vec2f,
    radius: f32,
    lifetime: f32,
    id: u32,
};

struct Stack{
	top_index: atomic<u32>,
	arr: array<u32, MAX_Particle>,
};

struct StackRead{
	top_index: u32,
	arr: array<u32, MAX_Particle>,
};

struct StorageRead{
	computeParam: vec3<u32>,
	emissionCount: u32,
}

fn bitAt(e1: u32, idx: u32) -> u32{
    return (e1 >> idx) & 0xFFFFFFFE;
}

fn bitFlip(e1: u32, idx: u32) -> u32{
    return e1 ^ (1u << idx);
}

fn stackPush(stk: ptr<storage, Stack, read_write>, val: u32){
    let top = atomicAdd(&(*stk).top_index, 1u); //add 1 after value is returned
    (*stk).arr[top] = val;
}
fn stackPop(stk: ptr<storage, Stack, read_write>) -> u32{
    let top = atomicSub(&(*stk).top_index, 1u);
    return (*stk).arr[top - 1u];
}
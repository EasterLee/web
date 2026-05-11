struct UI {
    resolution: vec2f,
};

struct Particle {
    color: vec4f,
    pos: vec2f,
    vel: vec2f,
};

struct VSOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
    @location(1) radius: f32,
    @location(2) uv: vec2f,
};

@group(0) @binding(0) var<uniform> ui: UI;
@group(0) @binding(1) var<storage, read> particles: array<Particle>;

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
struct VSOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
    @location(1) radius: f32,
    @location(2) uv: vec2f,
};


@group(0) @binding(0) var<uniform> ui: UI;
@group(0) @binding(1) var<storage, read> ps: ParticleSystem;
@group(0) @binding(2) var<storage, read> aliveIdx: StackRead;



@group(1) @binding(0) var _sampler: sampler;
@group(1) @binding(1) var _texture: texture_2d<f32>;

@vertex fn vs(
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
) -> VSOutput {
    
    let particleIdx = aliveIdx.arr[instanceIndex];
    let p = ps.particles[particleIdx];

    let verts = array(
        vec2f(-1, 1), //<- top
        vec2f(-1, -1), //left bottom
        vec2f(1, -1), //right bottom
        
        vec2f(1, -1), //right bottom
        vec2f(1, 1), //right top
        vec2f(-1, 1), //left top
    );

    let scaled = verts[vertexIndex] * 25;
    let offset = (scaled + p.pos)/ui.resolution; // 0 <-> 1
    let two = offset * 2; // 0 <-> 1 to 0 <-> 2 space
    let clipSpace = two - 1; // 0 <-> 2 to -1 <-> 1
    let flip = clipSpace * vec2f(1, -1); // flip y


    var vsOut: VSOutput;
    vsOut.position = vec4f(flip, f32(p.id)/1000000, 1.0);
    // vsOut.color = p.color;
    vsOut.uv = (verts[vertexIndex] * vec2f(1, -1) + 1) / 2 ;
    return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
    var color = textureSample(_texture, _sampler, vsOut.uv);
    // color *= 0.5;
    return color;
}
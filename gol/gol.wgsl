struct UI {
    resolution: vec2f,
    brushSize: f32,
};
struct VSOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
};


@group(0) @binding(0) var<uniform> ui: UI;
@group(0) @binding(1) var<uniform> mousePos: array<vec2f, 100>;
@group(1) @binding(0) var mySampler: sampler;
@group(1) @binding(1) var myTexture: texture_2d<f32>;

@vertex fn vs(
    @builtin(vertex_index) vertexIndex: u32,
) -> VSOutput {

    let verts = array(
        vec2f(-1, 1), //<- top
        vec2f(-1, -1), //left bottom
        vec2f(1, -1), //right bottom
        
        vec2f(1, -1), //right bottom
        vec2f(1, 1), //right top
        vec2f(-1, 1), //left top
    );

    var vsOut: VSOutput;
    vsOut.position = vec4f(verts[vertexIndex], 0.0, 1.0);
    vsOut.uv = verts[vertexIndex];
    return vsOut;
}

fn toClip(vert: vec2f) -> vec4f {
    let offset = vert/ui.resolution; // 0 <-> 1
    let two = offset * 2; // 0 <-> 1 to 0 <-> 2 space
    let clipSpace = two - 1; // 0 <-> 2 to -1 <-> 1
    let flip = clipSpace * vec2f(1.0, -1.0); // flip y
    return vec4f(flip, 0.0, 1.0);
}

fn toAbsolute(vert: vec2f) -> vec2f {
    let abs = ((vert * vec2f(1.0, -1.0)) + 1.0) / 2.0 * ui.resolution;
    return abs;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
    let newUV = vsOut.uv * vec2f(0.5, -0.5) + 0.5; // texture samples uses 0 <-> 1 uv
    var color = textureSample(myTexture, mySampler, newUV);
    let unit = vec2f(1.0, 1.0)/ui.resolution;
    let tl = textureSample(myTexture, mySampler, newUV + vec2f(-1.0, 1.0)*unit);
    let tm = textureSample(myTexture, mySampler, newUV + vec2f(0.0, 1.0)*unit);
    let tr = textureSample(myTexture, mySampler, newUV + vec2f(1.0, 1.0)*unit);
    let ml = textureSample(myTexture, mySampler, newUV + vec2f(-1.0, 0.0)*unit);
    let mm = textureSample(myTexture, mySampler, newUV + vec2f(0.0, 0.0)*unit);
    let mr = textureSample(myTexture, mySampler, newUV + vec2f(1.0, 0.0)*unit);
    let bl = textureSample(myTexture, mySampler, newUV + vec2f(-1.0, -1.0)*unit);
    let bm = textureSample(myTexture, mySampler, newUV + vec2f(0.0, -1.0)*unit);
    let br = textureSample(myTexture, mySampler, newUV + vec2f(1.0, -1.0)*unit);
    let alive = mm.r > 0.5;
    let aliveNear = tl.a + tm.a + tr.a + ml.a + mr.a + bl.a + bm.a + br.a;
    if (alive){
        // make dead
        if (aliveNear < 2.0 || aliveNear > 3.0) {
            color = vec4f(0.0, 0.0, 0.0, 0.0);
        }
    } else {
        // make alive
        if (aliveNear == 3.0) {
            color = vec4f(1.0, 0.0, 0.0, 1.0);
        }
    }
    return color;
}

@vertex fn vsPaint(
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
) -> VSOutput {
    
	let scale = ui.brushSize;
	let pos =  mousePos[instanceIndex];
    let res = ui.resolution;


    let verts = array(
        vec2f(-1, 1), //<- top
        vec2f(-1, -1), //left bottom
        vec2f(1, -1), //right bottom
        
        vec2f(1, -1), //right bottom
        vec2f(1, 1), //right top
        vec2f(-1, 1), //left top
    );

    let scaled = verts[vertexIndex] * scale;
    let offset = (scaled + pos)/res; // 0 <-> 1
    let two = offset * 2; // 0 <-> 1 to 0 <-> 2 space
    let clipSpace = two - 1; // 0 <-> 2 to -1 <-> 1
    let flip = clipSpace * vec2f(1.0, -1.0); // flip y

    var vsOut: VSOutput;
    vsOut.position = vec4f(flip, 0.0, 1.0);
    vsOut.uv = verts[vertexIndex];
    return vsOut;
}

@fragment fn fsPaint(vsOut: VSOutput) -> @location(0) vec4f {
    if (dot(vsOut.uv , vsOut.uv) > 1) {
        discard;
    }
    return vec4f(1.0, 0.0, 0.0, 1.0);
}
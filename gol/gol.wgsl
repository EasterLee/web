struct UI {
    resolution: vec2f,
    mouse: vec2f,
    mouseOver: f32,
};
struct VSOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
    @location(1) radius: f32,
    @location(2) uv: vec2f,
};


@group(0) @binding(0) var<uniform> ui: UI;
@group(1) @binding(0) var mySampler: sampler;
@group(1) @binding(1) var myTexture: texture_2d<f32>;

@vertex fn vs(
    @builtin(vertex_index) vertexIndex: u32,
) -> VSOutput {

	let scale = 500.0;
	let pos = ui.mouse;


    let verts = array(
        vec2f(-1, 1), //<- top
        vec2f(-1, -1), //left bottom
        vec2f(1, -1), //right bottom
        
        vec2f(1, -1), //right bottom
        vec2f(1, 1), //right top
        vec2f(-1, 1), //left top
    );

    let scaled = verts[vertexIndex] * 25.0;
    let offset = (scaled + pos)/ui.resolution; // 0 <-> 1
    let two = offset * 2; // 0 <-> 1 to 0 <-> 2 space
    let clipSpace = two - 1; // 0 <-> 2 to -1 <-> 1
    let flip = clipSpace * vec2f(1.0, -1.0); // flip y


    var vsOut: VSOutput;
    //vsOut.position = vec4f(flip, 0.0, 1.0);
    vsOut.position = vec4f(verts[vertexIndex], 0.0, 1.0);
    vsOut.color = vec4f(1.0, 1.0, 1.0, ui.mouseOver);
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
    let newUV = vsOut.uv * vec2f(0.5, -0.5) + 0.5;
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
    let aliveNear = tl.r + tm.r + tr.r + ml.r + mr.r + bl.r + bm.r + br.r;
    if (alive){
        if (aliveNear < 2.0 || aliveNear > 3.0) {
            color = vec4f(0.0, 0.0, 0.0, 1.0);
        }
    } else {
        if (aliveNear == 3.0) {
            color = vec4f(1.0, 0.0, 0.0, 1.0);
        }
    }

    let offset = toAbsolute(vsOut.uv) - ui.mouse;
    if (dot(offset, offset) < 50.0 && ui.mouseOver > 0.0) {
        return vec4f(1.0, 0.0, 0.0, 1.0);
    }
    return color;
}
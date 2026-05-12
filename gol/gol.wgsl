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
    vsOut.position = vec4f(flip, 0.0, 1.0);
    // vsOut.position = vec4f(verts[vertexIndex], 0.0, 1.0);
    vsOut.color = vec4f(1.0, 1.0, 1.0, ui.mouseOver);
    vsOut.uv = verts[vertexIndex];
    return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
    if (vsOut.color.a > 0.0) {
        return vsOut.color;
    }
    return vec4f(0.0, 0.0, 0.0, 1.0);
}
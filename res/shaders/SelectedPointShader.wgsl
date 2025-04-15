@group(0) @binding(0) var<uniform> camera: Camera;

struct VertexShaderOutput {
  @builtin(position) position: vec4f,
};

@vertex
fn vs(
    @builtin(vertex_index) vertexIndex: u32
) -> VertexShaderOutput {
    

    var vsOutput: VertexShaderOutput;

    if(camera.area_selector > 0) {

        let lines = array(
            // bottom
            vec2u(camera.cursor_x, camera.cursor_y),
            vec2u(camera.cursor_x2, camera.cursor_y),

            // right
            vec2u(camera.cursor_x2, camera.cursor_y),
            vec2u(camera.cursor_x2, camera.cursor_y2),

            // top
            vec2u(camera.cursor_x2, camera.cursor_y2),
            vec2u(camera.cursor_x, camera.cursor_y2),

            // left
            vec2u(camera.cursor_x, camera.cursor_y2),
            vec2u(camera.cursor_x, camera.cursor_y),
        );
        var xy = vec2f(lines[vertexIndex]) / vec2f(vec2u(camera.width, camera.height));
        vsOutput.position = vec4f(xy * 2 - 1, 0.0, 1.0);

    } else {

        let lines = array(
            // bottom
            vec2f(-1.0, -1.0),
            vec2f(1.0, -1.0),

            // right
            vec2f(1.0, -1.0),
            vec2f(1.0, 1.0),

            // top
            vec2f(1.0, 1.0),
            vec2f(-1.0, 1.0),

            // left
            vec2f(-1.0, 1.0),
            vec2f(-1.0, -1.0),
        );
        var xy = lines[vertexIndex];

        let aspect = f32(camera.width) / f32(camera.height);
        xy = vec2f(xy.x, xy.y * aspect) * 0.005;
        xy = xy + (2.0 * vec2f(f32(camera.cursor_x) / f32(camera.width), f32(camera.cursor_y) / f32(camera.height))  - 1.0);
        vsOutput.position = vec4f(xy, 0.0, 1.0);
    }

    return vsOutput;
}


@fragment
fn fs(fsInput: VertexShaderOutput) -> @location(0) vec4f {
    return vec4f(camera.r, camera.g, camera.b, 1);
}
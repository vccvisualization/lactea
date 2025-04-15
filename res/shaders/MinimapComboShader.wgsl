struct VertexShaderOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> VertexShaderOutput {
  let pos = array(
    // 1st triangle
    vec2f( 0.0,  0.0),  // center
    vec2f( 1.0,  0.0),  // right, center
    vec2f( 0.0,  1.0),  // center, top

    // 2st triangle
    vec2f( 0.0,  1.0),  // center, top
    vec2f( 1.0,  0.0),  // right, center
    vec2f( 1.0,  1.0),  // right, top
  );

  var vsOutput: VertexShaderOutput;
  let xy = pos[vertexIndex];
  let translate = vec2f(.65, -.65);
  let scale = .25;
  vsOutput.position = vec4f(((xy * 2 - 1)) * scale + translate, 0.0, 1.0);
  vsOutput.texcoord = vec2f(xy.x, 1.0 - xy.y);
  return vsOutput;
}

@group(0) @binding(0) var smplr: sampler;
@group(0) @binding(1) var borderTexture: texture_2d<f32>;
@group(0) @binding(2) var areaTexure: texture_2d<f32>;


@fragment fn fs(fsInput: VertexShaderOutput) -> @location(0) vec4f {
  let border = textureSample(borderTexture, smplr, fsInput.texcoord);
  let area = textureSample(areaTexure, smplr, fsInput.texcoord);
  return (border * (1-area)) + (area * (1-border));

}
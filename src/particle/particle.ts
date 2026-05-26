import shaderSrc from "./simple_particle.wgsl?raw";
import { makeShaderDataDefinitions, makeStructuredView } from "webgpu-utils";
const defs = makeShaderDataDefinitions(shaderSrc);
console.log(defs);

async function loadImageBitmap(url: string) {
	const res = await fetch(url);
	const blob = await res.blob();
	return await createImageBitmap(blob, { colorSpaceConversion: "none" });
}

async function main() {
	console.log("Hello!");

	const adapter = await navigator.gpu.requestAdapter();
	const device = (await adapter?.requestDevice({
		requiredFeatures: ["timestamp-query"],
		requiredLimits: {
			maxTextureDimension2D: 13950,
		},
	})) as GPUDevice;
	if (!device) {
		throw new Error("Need a browser that support WebGPU");
	}

	const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
	const canvas = document.querySelector("canvas") as HTMLCanvasElement;
	const context = canvas.getContext("webgpu") as GPUCanvasContext;
	const dpr = window.devicePixelRatio || 1;
	canvas.width = canvas.clientWidth * dpr;
	canvas.height = canvas.clientHeight * dpr;
	console.log(canvas.width, canvas.height, dpr);
	context.configure({
		device: device,
		format: presentationFormat,
	});

	const module = device.createShaderModule({
		label: "shader module",
		code: shaderSrc,
	});

	const renderPassDescriptor: GPURenderPassDescriptor = {
		label: "Render Pass Descriptor",
		colorAttachments: [
			{
				view: undefined as unknown as GPUTextureView,
				clearValue: [0, 0, 0, 1],
				loadOp: "clear",
				storeOp: "store",
			},
		],
	};

	const renderPipeline = device.createRenderPipeline({
		label: "Render Pipeline Descriptor",
		vertex: {
			module: module,
			entryPoint: "vs",
		},
		fragment: {
			module: module,
			entryPoint: "fs",
			targets: [
				{
					format: presentationFormat,
				},
			],
		},
		layout: "auto",
	});

	/*
		UI Buffer:
			resolution: vec2f,
			mouse: vec2f,
	*/
	const uiValue = new Float32Array(4);
	uiValue.set([canvas.width, canvas.height]);
	const uiBuffer = device.createBuffer({
		label: "uiBuffer",
		size: uiValue.byteLength,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});
	device.queue.writeBuffer(uiBuffer, 0, uiValue, 0, 2);
	/*
		Particle Buffer:
			array<Particle>
			struct Particle {
				color: vec4f,
				pos: vec2f,
				vel: vec2f,
				radius: f32,
			};
	*/
	const singleParticleSize = 4 * 2 * 2 * 1;
	const particleValue = new Float32Array(singleParticleSize * 10);
	particleValue.set([1, 1, 1, 1, canvas.width / 2, canvas.height / 2]);
	const particleBuffer = device.createBuffer({
		label: "particleValue",
		size: particleValue.byteLength,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	});
	device.queue.writeBuffer(particleBuffer, 4 * 4, particleValue, 4, 2);

	const bindGroup0 = device.createBindGroup({
		label: "Paint BindGroup",
		layout: renderPipeline.getBindGroupLayout(0),
		entries: [
			{ binding: 0, resource: uiBuffer },
			{ binding: 1, resource: particleBuffer },
		],
	});

	/*
		Texture Stuffs
	 */
	const url = "/png/f-texture.png";
	const source = await loadImageBitmap(url);
	const fTexture = device.createTexture({
		label: url,
		format: "rgba8unorm",
		size: [source.width, source.height],
		usage:
			GPUTextureUsage.TEXTURE_BINDING |
			GPUTextureUsage.COPY_DST |
			GPUTextureUsage.RENDER_ATTACHMENT,
	});
	device.queue.copyExternalImageToTexture(
		{ source: source, flipY: true },
		{ texture: fTexture },
		{ width: source.width, height: source.height },
	);

	const sampler = device.createSampler({
		addressModeU: "clamp-to-edge",
		addressModeV: "clamp-to-edge",
		magFilter: "linear",
	});

	const bindGroup1 = device.createBindGroup({
		label: "Texture BindGroup",
		layout: renderPipeline.getBindGroupLayout(1),
		entries: [
			{ binding: 0, resource: sampler },
			{ binding: 1, resource: fTexture },
		],
	});

	function render() {
		renderPassDescriptor.colorAttachments[0]!.view = context
			.getCurrentTexture()
			.createView();
		const encoder = device.createCommandEncoder({ label: "Render Encoder" });

		const renderPass = encoder.beginRenderPass(renderPassDescriptor);
		renderPass.setPipeline(renderPipeline);
		renderPass.setBindGroup(0, bindGroup0);
		renderPass.setBindGroup(1, bindGroup1);
		//renderPass.setBindGroup(1, texBindGroupA);
		renderPass.draw(6, 1);
		renderPass.end();

		// encoder.copyTextureToTexture(
		// 	{ texture: textureA },
		// 	{ texture: context.getCurrentTexture() },
		// 	[canvas.width, canvas.height],
		// );

		device.queue.submit([encoder.finish()]);
	}
	render();
}

await main();

import shaderSrc from "./wgsl/simple_particle.wgsl?raw";
import commonSrc from "./wgsl/common.wgsl?raw";
import computeSrc from "./wgsl/compute.wgsl?raw";

import {
	makeShaderDataDefinitions,
	makeStructuredView,
	setVertexAndIndexBuffers,
} from "webgpu-utils";
const defs = makeShaderDataDefinitions(commonSrc + shaderSrc);
const computeDefs = makeShaderDataDefinitions(commonSrc + computeSrc);
console.log(defs);
console.log(computeDefs);

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
		code: commonSrc + shaderSrc,
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
	const psDefs = defs.structs.ParticleSystem;
	const psStruct = makeStructuredView(psDefs);
	psStruct.set({
		particles: [
			{
				color: [1, 1, 1, 1],
				pos: [canvas.width / 2, canvas.height / 2],
				vel: [0, 0],
				radius: 1,
			},
			{
				color: [1, 1, 1, 1],
				pos: [canvas.width / 4, canvas.height / 4],
				vel: [0, 0],
				radius: 1,
			},
		],
		drawParam: [6, 2],
	});
	const psBuffer = device.createBuffer({
		label: "particleValue",
		size: psStruct.arrayBuffer.byteLength,
		usage:
			GPUBufferUsage.STORAGE |
			GPUBufferUsage.COPY_DST |
			GPUBufferUsage.INDIRECT,
	});
	device.queue.writeBuffer(psBuffer, 0, psStruct.arrayBuffer);

	const bindGroup0 = device.createBindGroup({
		label: "Paint BindGroup",
		layout: renderPipeline.getBindGroupLayout(0),
		entries: [
			{ binding: 0, resource: uiBuffer },
			{ binding: 1, resource: psBuffer },
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
		renderPass.drawIndirect(psBuffer, psDefs.fields.drawParam.offset);
		renderPass.end();

		// encoder.copyTextureToTexture(
		// 	{ texture: textureA },
		// 	{ texture: context.getCurrentTexture() },
		// 	[canvas.width, canvas.height],
		// );

		device.queue.submit([encoder.finish()]);
	}

	/*

		Compute

	 */
	const computeModule = device.createShaderModule({
		label: "compute module",
		code: commonSrc + computeSrc,
	});
	const computePipeline = device.createComputePipeline({
		label: "Compute Pipeline Descriptor",
		compute: {
			module: computeModule,
		},
		layout: "auto",
	});
	const stateDefs = computeDefs.structs.StateStacks;
	const stateStruct = makeStructuredView(stateDefs);
	const stateBuffer = device.createBuffer({
		label: "State Buffer",
		size: stateStruct.arrayBuffer.byteLength,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	});
	const readDefs = computeDefs.structs.StorageRead;
	const readStruct = makeStructuredView(readDefs);
	const readBuffer = device.createBuffer({
		label: "read Buffer",
		size: readStruct.arrayBuffer.byteLength,
		usage:
			GPUBufferUsage.STORAGE |
			GPUBufferUsage.COPY_DST |
			GPUBufferUsage.INDIRECT,
	});
	const computeBindGroup0 = device.createBindGroup({
		label: "Compute BindGroup",
		layout: computePipeline.getBindGroupLayout(0),
		entries: [
			{ binding: 0, resource: uiBuffer },
			{ binding: 1, resource: psBuffer },
			{ binding: 2, resource: stateBuffer },
			{ binding: 3, resource: readBuffer },
		],
	});

	function compute() {
		const encoder = device.createCommandEncoder({
			label: "compute command encoder",
		});
		const computePass = encoder.beginComputePass({
			label: "compute pass descript",
		});
		computePass.setPipeline(computePipeline);
		computePass.setBindGroup(0, computeBindGroup0);
		computePass.dispatchWorkgroupsIndirect(
			readBuffer,
			readDefs.fields.emissionCount.offset,
		);
		computePass.end();
		device.queue.submit([encoder.finish()]);
	}
	compute();
}

await main();

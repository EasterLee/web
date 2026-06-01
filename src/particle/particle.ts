import shaderSrc from "./wgsl/simple_particle.wgsl?raw";
import commonSrc from "./wgsl/common.wgsl?raw";
import emitSrc from "./wgsl/emit.wgsl?raw";
import operateSrc from "./wgsl/operate.wgsl?raw";

import { makeShaderDataDefinitions, makeStructuredView } from "webgpu-utils";
const commonDefs = makeShaderDataDefinitions(commonSrc);
const defs = makeShaderDataDefinitions(commonSrc + shaderSrc);
const emitDefs = makeShaderDataDefinitions(commonSrc + emitSrc);
const operateDefs = makeShaderDataDefinitions(commonSrc + operateSrc);

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
		alphaMode: "premultiplied",
	});

	const struct = {
		ui: makeStructuredView(commonDefs.structs.UI),
		ps: makeStructuredView(commonDefs.structs.ParticleSystem),
		computeParam: makeStructuredView(commonDefs.structs.StorageRead),
		dead: makeStructuredView(commonDefs.structs.Stack),
	};

	struct.ui.set({ resolution: [canvas.width, canvas.height] });
	struct.ps.set({
		param: {
			vertex_count: 6, // or index_count
		},
	});
	struct.dead.set({
		top_index: 100000,
		arr: Array.from({ length: 100000 }, (_, i) => 99999 - i),
	});
	const initEmission = 100;
	struct.computeParam.set({
		emissionCount: initEmission,
		computeParam: [Math.ceil(initEmission / 64), 1, 1],
	});

	const module = {
		render: device.createShaderModule({
			label: "Render Module",
			code: commonSrc + shaderSrc,
		}),
		emit: device.createShaderModule({
			label: "Emit Module",
			code: commonSrc + emitSrc,
		}),
		operate: device.createShaderModule({
			label: "Operate Module",
			code: commonSrc + operateSrc,
		}),
	};

	const pipeline = {
		emit: device.createComputePipeline({
			label: "emit Pipeline Descriptor",
			compute: {
				module: module.emit,
				entryPoint: "emit",
			},
			layout: "auto",
		}),

		postEmit: device.createComputePipeline({
			label: "post emit Pipeline Descriptor",
			compute: {
				module: module.emit,
				entryPoint: "post_emit",
			},
			layout: "auto",
		}),

		operate: device.createComputePipeline({
			label: "operate Pipeline Descriptor",
			compute: {
				module: module.operate,
				entryPoint: "operate",
			},
			layout: "auto",
		}),

		postOperate: device.createComputePipeline({
			label: "operate Pipeline Descriptor",
			compute: {
				module: module.operate,
				entryPoint: "post_operate",
			},
			layout: "auto",
		}),

		render: device.createRenderPipeline({
			label: "Render Pipeline Descriptor",
			vertex: {
				module: module.render,
				entryPoint: "vs",
			},
			fragment: {
				module: module.render,
				entryPoint: "fs",
				targets: [
					{
						format: presentationFormat,
					},
				],
			},
			depthStencil: {
				format: "depth24plus",
				depthWriteEnabled: true,
				depthCompare: "greater",
			},
			layout: "auto",
		}),
	};

	const buffer = {
		ui: device.createBuffer({
			label: "ui buffer",
			size: defs.structs.UI.size,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		}),

		ps: device.createBuffer({
			label: "particle system buffer",
			size: defs.structs.ParticleSystem.size,
			usage:
				GPUBufferUsage.STORAGE |
				GPUBufferUsage.COPY_DST |
				GPUBufferUsage.INDIRECT |
				GPUBufferUsage.COPY_SRC,
		}),

		aliveA: device.createBuffer({
			label: "alive Buffer A",
			size: commonDefs.structs.Stack.size,
			usage:
				GPUBufferUsage.STORAGE |
				GPUBufferUsage.COPY_DST |
				GPUBufferUsage.COPY_SRC,
		}),

		aliveB: device.createBuffer({
			label: "alive Buffer B",
			size: commonDefs.structs.Stack.size,
			usage:
				GPUBufferUsage.STORAGE |
				GPUBufferUsage.COPY_DST |
				GPUBufferUsage.COPY_SRC,
		}),

		dead: device.createBuffer({
			label: "dead Buffer",
			size: commonDefs.structs.Stack.size,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		}),

		computeParam: device.createBuffer({
			label: "compute param Buffer",
			size: commonDefs.structs.StorageRead.size,
			usage:
				GPUBufferUsage.STORAGE |
				GPUBufferUsage.COPY_DST |
				GPUBufferUsage.INDIRECT,
		}),

		staging: device.createBuffer({
			size: commonDefs.structs.ParticleSystem.size,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
		}),
		staging2: device.createBuffer({
			size: commonDefs.structs.Stack.size,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
		}),
	};

	device.queue.writeBuffer(buffer.ui, 0, struct.ui.arrayBuffer);
	device.queue.writeBuffer(buffer.ps, 0, struct.ps.arrayBuffer);
	device.queue.writeBuffer(buffer.dead, 0, struct.dead.arrayBuffer);
	device.queue.writeBuffer(
		buffer.computeParam,
		0,
		struct.computeParam.arrayBuffer,
	);

	canvas.addEventListener("mousemove", (e) => {
		const rect = canvas.getBoundingClientRect();
		device.queue.writeBuffer(
			buffer.ui,
			commonDefs.structs.UI.fields.mouse.offset,
			new Float32Array([e.x - rect.x, e.y - rect.y]).buffer,
		);
	});

	const depthTexture = device.createTexture({
		size: [canvas.width, canvas.height],
		format: "depth24plus",
		usage: GPUTextureUsage.RENDER_ATTACHMENT,
	});
	const renderPassDescriptor: GPURenderPassDescriptor = {
		label: "Render Pass Descriptor",
		colorAttachments: [
			{
				view: undefined as unknown as GPUTextureView,
				clearValue: [0, 0, 0, 0],
				loadOp: "clear",
				storeOp: "store",
			},
		],
		depthStencilAttachment: {
			view: depthTexture.createView(),
			depthClearValue: 0.0,
			depthLoadOp: "clear",
			depthStoreOp: "store",
		},
	};

	function createFrameBindGroups(A: GPUBuffer, B: GPUBuffer) {
		return {
			emit: device.createBindGroup({
				label: "Emit BindGroup",
				layout: pipeline.emit.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: buffer.ps },
					{ binding: 1, resource: buffer.computeParam },
					{ binding: 2, resource: A },
					{ binding: 3, resource: buffer.dead },
					{ binding: 4, resource: buffer.ui },
				],
			}),

			postEmit: device.createBindGroup({
				label: "Post Emit BindGroup",
				layout: pipeline.postEmit.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: buffer.ps },
					{ binding: 1, resource: buffer.computeParam },
					{ binding: 2, resource: A },
				],
			}),

			operate: device.createBindGroup({
				label: "Operate BindGroup",
				layout: pipeline.operate.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: buffer.ps },
					{ binding: 1, resource: A },
					{ binding: 2, resource: B },
					{ binding: 3, resource: buffer.dead },
				],
			}),

			postOperate: device.createBindGroup({
				label: "Post Operate BindGroup",
				layout: pipeline.postOperate.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: buffer.ps },
					{ binding: 1, resource: A },
					{ binding: 2, resource: B },
				],
			}),

			render: device.createBindGroup({
				label: "Render BindGroup",
				layout: pipeline.render.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: buffer.ui },
					{ binding: 1, resource: buffer.ps },
					{ binding: 2, resource: B },
				],
			}),
		};
	}

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
		layout: pipeline.render.getBindGroupLayout(1),
		entries: [
			{ binding: 0, resource: sampler },
			{ binding: 1, resource: fTexture },
		],
	});

	async function debugStacks() {
		const encoder = device.createCommandEncoder();
		// read first 4 bytes (top_index) of each alive buffer
		encoder.copyBufferToBuffer(buffer.ps, 0, buffer.staging, 0);
		encoder.copyBufferToBuffer(
			alternate ? buffer.aliveA : buffer.aliveB,
			0,
			buffer.staging2,
			0,
		);
		device.queue.submit([encoder.finish()]);

		await buffer.staging.mapAsync(GPUMapMode.READ);
		await buffer.staging2.mapAsync(GPUMapMode.READ);
		const view = makeStructuredView(
			commonDefs.structs.ParticleSystem,
			buffer.staging.getMappedRange().slice(),
		);
		const view2 = makeStructuredView(
			commonDefs.structs.Stack,
			buffer.staging2.getMappedRange().slice(),
		);
		console.log(view.views);
		console.log(view2.views);
		buffer.staging.unmap();
		buffer.staging2.unmap();
	}

	const bindGroupA = createFrameBindGroups(buffer.aliveA, buffer.aliveB);
	const bindGroupB = createFrameBindGroups(buffer.aliveB, buffer.aliveA);
	var curBindGroup;

	window.d = debugStacks;
	window.t = 0;
	var frame = 0;
	var alternate = false;
	async function animate() {
		requestAnimationFrame(animate);
		// if (window.t <= 0) {
		// 	return;
		// }
		// if (window.t == 1) {
		// }
		// window.t--;
		// console.log(frame++);

		// emit();
		// operate();
		// alternate = !alternate;
		// render();

		/*
			Emit
		*/

		alternate = !alternate;

		curBindGroup = alternate ? bindGroupA : bindGroupB;
		const encoder = device.createCommandEncoder({
			label: "emit command encoder",
		});
		const emitPass = encoder.beginComputePass({
			label: "emit pass descript",
		});
		emitPass.setPipeline(pipeline.emit);
		emitPass.setBindGroup(0, curBindGroup.emit);
		emitPass.dispatchWorkgroups(1, 1, 1);
		emitPass.end();

		const postemitPass = encoder.beginComputePass({
			label: "post emit pass descript",
		});
		postemitPass.setPipeline(pipeline.postEmit);
		postemitPass.setBindGroup(0, curBindGroup.postEmit);
		postemitPass.dispatchWorkgroups(1, 1, 1);
		postemitPass.end();

		/*
			Operate
		*/

		const operatePass = encoder.beginComputePass({
			label: "operate pass descript",
		});
		operatePass.setPipeline(pipeline.operate);
		operatePass.setBindGroup(0, curBindGroup.operate);
		operatePass.dispatchWorkgroupsIndirect(
			buffer.computeParam,
			commonDefs.structs.StorageRead.fields.computeParam.offset,
		);
		operatePass.end();

		const postoperatePass = encoder.beginComputePass({
			label: "post emit pass descript",
		});
		postoperatePass.setPipeline(pipeline.postOperate);
		postoperatePass.setBindGroup(0, curBindGroup.postOperate);
		postoperatePass.dispatchWorkgroups(1, 1, 1);
		postoperatePass.end();

		/*
			Render
		*/

		renderPassDescriptor.colorAttachments[0]!.view = context
			.getCurrentTexture()
			.createView();

		const renderPass = encoder.beginRenderPass(renderPassDescriptor);
		renderPass.setPipeline(pipeline.render);
		renderPass.setBindGroup(0, curBindGroup.render);
		renderPass.setBindGroup(1, bindGroup1);
		renderPass.drawIndirect(
			buffer.ps,
			commonDefs.structs.ParticleSystem.fields.param.offset,
		);
		renderPass.end();

		device.queue.submit([encoder.finish()]);
	}
	requestAnimationFrame(animate);
}

await main();

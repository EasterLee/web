import shaderSrc from "./gol.wgsl?raw";

const SIZE = {
	vec2: 8,
	vec4: 16,
};

async function main() {
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
	canvas.style.imageRendering = "pixelated";

	const shaderModule = device.createShaderModule({
		label: "Render Shader",
		code: shaderSrc,
	});

	const renderPassDescriptor: GPURenderPassDescriptor = {
		label: "Render Pass Descriptor",
		colorAttachments: [
			{
				view: undefined as unknown as GPUTextureView,
				clearValue: [0.0, 0.0, 0.0, 1.0],
				loadOp: "clear",
				storeOp: "store",
			},
		],
	};

	let uiBufferValue = new Float32Array(5);
	let uiBufferSize = SIZE.vec2 * 3; //resolution + mouse position + padding
	const uiBuffer = device.createBuffer({
		label: `uiBuffer`,
		size: uiBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});

	const ratio = 0.25;

	{
		function resizeCanvas() {
			canvas.style.width = "100vw";
			canvas.style.height = "100vh";
			canvas.width = canvas.clientWidth * ratio;
			canvas.height = canvas.clientHeight * ratio;
			context.configure({
				device: device,
				format: presentationFormat,
			});
			uiBufferValue.set([canvas.width, canvas.height]);
			device.queue.writeBuffer(uiBuffer, 0, uiBufferValue);
		}
		resizeCanvas();
		window.addEventListener("resize", resizeCanvas);

		function mouseMoveCanvas(e: MouseEvent) {
			const x = e.x;
			const y = e.y;
			uiBufferValue.set([x * ratio, y * ratio], 2);
			device.queue.writeBuffer(uiBuffer, SIZE.vec2, uiBufferValue, 2, 2);
			console.log("Mouse move canvas at: ", x, y);
		}

		function toggleMouseOverCanvas(value: boolean) {
			uiBufferValue.set([value ? 1 : 0], 4);
			console.log(uiBufferValue);
			device.queue.writeBuffer(uiBuffer, SIZE.vec2 * 2, uiBufferValue, 4, 1);
		}

		function mouseOn() {
			toggleMouseOverCanvas(true);
			console.log("Mouse over canvas");
		}

		function mouseOff() {
			toggleMouseOverCanvas(false);
			console.log("Mouse out of canvas");
		}

		window.addEventListener("mousemove", mouseMoveCanvas);
		window.addEventListener("mousedown", mouseOn);
		window.addEventListener("mouseup", mouseOff);
	}
	let textureRead = device.createTexture({
		size: [canvas.width, canvas.height],
		format: presentationFormat,
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
	});

	let textureWrite = device.createTexture({
		size: [canvas.width, canvas.height],
		format: presentationFormat,
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
	});

	const renderPipeline = device.createRenderPipeline({
		label: "Render Pipeline",
		layout: "auto",
		vertex: {
			module: shaderModule,
		},
		fragment: {
			module: shaderModule,
			targets: [{ format: presentationFormat }],
		},
	});

	const bindGroup = device.createBindGroup({
		label: "bind group for objects",
		layout: renderPipeline.getBindGroupLayout(0),
		entries: [{ binding: 0, resource: uiBuffer }],
	});
	let texBindGroupA = device.createBindGroup({
		label: "bind group for objects",
		layout: renderPipeline.getBindGroupLayout(1),
		entries: [
			{
				binding: 0,
				resource: device.createSampler({
					magFilter: "nearest",
					minFilter: "nearest",
				}),
			},
			{ binding: 1, resource: textureRead.createView() }, // your texture as input
		],
	});
	let texBindGroupB = device.createBindGroup({
		label: "bind group for objects",
		layout: renderPipeline.getBindGroupLayout(1),
		entries: [
			{
				binding: 0,
				resource: device.createSampler({
					magFilter: "nearest",
					minFilter: "nearest",
				}),
			},
			{ binding: 1, resource: textureWrite.createView() }, // your texture as input
		],
	});

	function render() {
		renderPassDescriptor.colorAttachments[0]!.view = context
			.getCurrentTexture()
			.createView();
		const encoder = device.createCommandEncoder({ label: "Render Encoder" });

		const renderPass = encoder.beginRenderPass({
			colorAttachments: [
				{
					view: context.getCurrentTexture().createView(), // canvas as output
					loadOp: "clear",
					storeOp: "store",
					clearValue: { r: 0, g: 0, b: 0, a: 1 },
				},
			],
		});
		renderPass.setPipeline(renderPipeline);
		renderPass.setBindGroup(0, bindGroup);
		renderPass.setBindGroup(1, texBindGroupA);
		renderPass.draw(6);
		renderPass.end();
		const writeTexturePassDescriptor: GPURenderPassDescriptor = {
			label: "Render Texture Pass Descriptor",
			colorAttachments: [
				{
					view: textureWrite.createView(),
					clearValue: [0.0, 0.0, 0.0, 1.0],
					loadOp: "clear",
					storeOp: "store",
				},
			],
		};
		const writePass = encoder.beginRenderPass(writeTexturePassDescriptor);
		writePass.setPipeline(renderPipeline);
		writePass.setBindGroup(0, bindGroup);
		writePass.setBindGroup(1, texBindGroupA);
		writePass.draw(6);
		writePass.end();

		device.queue.submit([encoder.finish()]);
		// Swap the textures for the next frame
		[textureRead, textureWrite] = [textureWrite, textureRead];
		[texBindGroupA, texBindGroupB] = [texBindGroupB, texBindGroupA];
	}
	let lastFrame = 0;
	const fps = 60;
	const frameInterval = 1000 / fps;
	function animate(timestamp: number) {
		requestAnimationFrame(animate);

		const delta = timestamp - lastFrame;
		if (delta > frameInterval) {
			render();
			lastFrame = timestamp - (delta % frameInterval);
		}
	}
	requestAnimationFrame(animate);
}
await main();

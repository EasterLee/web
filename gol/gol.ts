import shaderSrc from "./gol.wgsl?raw";
async function main() {
	const adapter = await navigator.gpu.requestAdapter();
	const device = (await adapter?.requestDevice({
		requiredFeatures: ["timestamp-query"],
	})) as GPUDevice;
	if (!device) {
		throw new Error("Need a browser that support WebGPU");
	}

	const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
	const canvas = document.querySelector("canvas") as HTMLCanvasElement;
	const context = canvas.getContext("webgpu") as GPUCanvasContext;

	const shaderModule = device.createShaderModule({
		label: "Render Shader",
		code: shaderSrc,
	});

	const pipeLine = device.createRenderPipeline({
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

	const renderPassDescriptor: GPURenderPassDescriptor = {
		label: "Render Pass Descriptor",
		colorAttachments: [
			{
				view: undefined as unknown as GPUTextureView,
				clearValue: [0.1, 0.1, 0.1, 1.0],
				loadOp: "clear",
				storeOp: "store",
			},
		],
	};

	let uiBufferValue = new Float32Array(2);
	let uiBufferSize = 2 * 4 + 8; //width + length float + padding
	const uiBuffer = device.createBuffer({
		label: `uiBuffer`,
		size: uiBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});

	{
		function resizeCanvas() {
			canvas.style.width = "100dvw";
			canvas.style.height = "100dvh";
			canvas.width = canvas.clientWidth * devicePixelRatio;
			canvas.height = canvas.clientHeight * devicePixelRatio;
			context.configure({
				device: device,
				format: presentationFormat,
			});

			uiBufferValue.set([canvas.width, canvas.height]);
			device.queue.writeBuffer(uiBuffer, 0, uiBufferValue);
		}
		resizeCanvas();
		window.addEventListener("resize", resizeCanvas);
	}

	const bindGroup = device.createBindGroup({
		label: "bind group for objects",
		layout: pipeLine.getBindGroupLayout(0),
		entries: [{ binding: 0, resource: uiBuffer }],
	});

	function render() {
		renderPassDescriptor.colorAttachments[0]!.view = context
			.getCurrentTexture()
			.createView();

		const encoder = device.createCommandEncoder({ label: "our encoder" });

		const pass = encoder.beginRenderPass(renderPassDescriptor);

		pass.setPipeline(pipeLine);
		pass.setBindGroup(0, bindGroup);
		pass.draw(6);
		pass.end();

		device.queue.submit([encoder.finish()]);
	}

	render();
}
await main();

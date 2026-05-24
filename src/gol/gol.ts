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
				clearValue: [0, 0, 0, 1],
				loadOp: "clear",
				storeOp: "store",
			},
		],
	};
	const paintPassDescriptor: GPURenderPassDescriptor = {
		label: "Render Pass Descriptor",
		colorAttachments: [
			{
				view: undefined as unknown as GPUTextureView,
				loadOp: "load",
				storeOp: "store",
			},
		],
	};
	const paintPipeline = device.createRenderPipeline({
		label: "Paint Pipeline",
		layout: "auto",
		vertex: {
			module: shaderModule,
			entryPoint: "vsPaint",
		},
		fragment: {
			module: shaderModule,
			targets: [{ format: presentationFormat }],
			entryPoint: "fsPaint",
		},
	});

	const renderPipeline = device.createRenderPipeline({
		label: "Render Pipeline",
		layout: "auto",
		vertex: {
			module: shaderModule,
			entryPoint: "vs",
		},
		fragment: {
			module: shaderModule,
			targets: [{ format: presentationFormat }],
			entryPoint: "fs",
		},
	});

	function createBlankTexture() {
		return device.createTexture({
			size: [canvas.width, canvas.height],
			format: presentationFormat,
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT |
				GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_SRC,
		});
	}
	function createBindGroup1(tex: GPUTexture) {
		return device.createBindGroup({
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
				{ binding: 1, resource: tex.createView() }, // your texture as input
			],
		});
	}

	let textureA: GPUTexture;
	let textureB: GPUTexture;
	let texBindGroupA: GPUBindGroup;
	let texBindGroupB: GPUBindGroup;

	function createTextureAndBindGroup() {
		textureA = createBlankTexture();
		textureB = createBlankTexture();
		texBindGroupA = createBindGroup1(textureA);
		texBindGroupB = createBindGroup1(textureB);
	}

	let uiBufferValue = new Float32Array(4);
	let uiBufferSize = SIZE.vec2 * 2; //resolution + mouse position + mouse toggle + brush size
	const uiBuffer = device.createBuffer({
		label: `uiBuffer`,
		size: uiBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});

	const ratio = 0.25;
	const mouseBufferMaxValue = 100;
	const mouseBufferValue = new Float32Array(mouseBufferMaxValue * 2);
	let mouseBufferIndex = 0;
	const mouseBuffer = device.createBuffer({
		label: `mouseBuffer`,
		size: mouseBufferValue.byteLength,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});
	{
		let timerId: ReturnType<typeof setTimeout>;
		function resizeCanvas() {
			canvas.style.width = "100vw";
			canvas.style.height = "100vh";
			canvas.width = canvas.clientWidth * ratio;
			canvas.height = canvas.clientHeight * ratio;
			context.configure({
				device: device,
				format: presentationFormat,
				usage: GPUTextureUsage.COPY_DST,
			});
			uiBufferValue.set([canvas.width, canvas.height]);
			device.queue.writeBuffer(uiBuffer, 0, uiBufferValue, 0, 2);

			createTextureAndBindGroup();
		}
		function createResizeTimer() {
			clearTimeout(timerId);
			timerId = setTimeout(resizeCanvas, 250);
		}
		resizeCanvas();
		canvas.addEventListener("resize", createResizeTimer);

		function enqueueMouse(x: number, y: number) {
			if (mouseBufferIndex >= mouseBufferMaxValue) return;
			mouseBufferValue.set([x * ratio, y * ratio], mouseBufferIndex * 2);
			mouseBufferIndex++;
			console.log(mouseBufferIndex);
		}
		function mouseMoveCanvas(e: MouseEvent) {
			if (!mouseOver) return;
			const [x, y] = [e.x, e.y];
			enqueueMouse(x, y);
			//console.log("Mouse move canvas at: ", x, y);
		}

		let mouseOver = false;
		function toggleMouseOverCanvas(value: boolean) {
			mouseOver = value;
			//console.log(uiBufferValue);
		}

		function mouseOn(e: MouseEvent) {
			const [x, y] = [e.x, e.y];
			toggleMouseOverCanvas(true);
			enqueueMouse(x, y);
			//console.log("Mouse over canvas");
		}

		function mouseOff() {
			toggleMouseOverCanvas(false);
			//console.log("Mouse out of canvas");
		}

		canvas.addEventListener("mousemove", mouseMoveCanvas, {
			passive: true,
			capture: true,
		});
		canvas.addEventListener("mousedown", mouseOn);
		canvas.addEventListener("mouseup", mouseOff);
		canvas.addEventListener("mouseleave", mouseOff);
	}

	let texturePaint: GPUTexture = device.createTexture({
		label: "texture Paint",
		size: [canvas.width, canvas.height],
		format: presentationFormat,
		usage:
			GPUTextureUsage.RENDER_ATTACHMENT |
			GPUTextureUsage.TEXTURE_BINDING |
			GPUTextureUsage.COPY_SRC,
	});

	const bindGroup = device.createBindGroup({
		label: "bind group for objects",
		layout: renderPipeline.getBindGroupLayout(0),
		entries: [{ binding: 0, resource: uiBuffer }],
	});
	const paintBindGroup = device.createBindGroup({
		label: "Paint BindGroup",
		layout: paintPipeline.getBindGroupLayout(0),
		entries: [
			{ binding: 0, resource: uiBuffer },
			{ binding: 1, resource: mouseBuffer },
		],
	});
	function render() {
		device.queue.writeBuffer(
			mouseBuffer,
			0,
			mouseBufferValue,
			0,
			mouseBufferIndex * 2,
		);
		paintPassDescriptor.colorAttachments[0]!.view = textureA.createView();
		const encoder = device.createCommandEncoder({ label: "Paint Encoder" });

		const renderPass = encoder.beginRenderPass(paintPassDescriptor);
		renderPass.setPipeline(paintPipeline);
		renderPass.setBindGroup(0, paintBindGroup);
		//renderPass.setBindGroup(1, texBindGroupA);
		renderPass.draw(6, mouseBufferIndex);
		renderPass.end();

		encoder.copyTextureToTexture(
			{ texture: textureA },
			{ texture: context.getCurrentTexture() },
			[canvas.width, canvas.height],
		);

		device.queue.submit([encoder.finish()]);
		mouseBufferIndex = 0;
	}
	function simulate() {
		const encoder = device.createCommandEncoder({ label: "Paint Encoder" });
		const writeTexturePassDescriptor: GPURenderPassDescriptor = {
			label: "Render Texture Pass Descriptor",
			colorAttachments: [
				{
					view: textureB.createView(),
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

		encoder.copyTextureToTexture(
			{ texture: textureA },
			{ texture: context.getCurrentTexture() },
			[canvas.width, canvas.height],
		);

		device.queue.submit([encoder.finish()]);

		// Swap the textures for the next frame
		[textureA, textureB] = [textureB, textureA];
		[texBindGroupA, texBindGroupB] = [texBindGroupB, texBindGroupA];
	}
	let lastFrame = 0;
	let fps = 60;
	let frameInterval = 1000 / fps;
	function changeFPS(value: number) {
		frameInterval = 1000 / value;
	}
	function animate(timestamp: number) {
		requestAnimationFrame(animate);
		render();
		const delta = timestamp - lastFrame;
		if (delta > frameInterval) {
			simulate();
			lastFrame = timestamp - (delta % frameInterval);
		}
	}
	requestAnimationFrame(animate);

	/**
	 *
	 * 	Set Configs
	 *
	 */
	// Brush Size
	const brushSliderInput = document.getElementById(
		"brush-size-slider",
	) as HTMLInputElement;
	const brushNumberInput = document.getElementById(
		"brush-size-number",
	) as HTMLInputElement;

	function setBrushSize(event: InputEvent) {
		let value = (event.target as HTMLInputElement).value;
		brushSliderInput.value = value;
		brushNumberInput.value = value;

		uiBufferValue.set([parseInt(value)], 2);
		device.queue.writeBuffer(uiBuffer, SIZE.vec2, uiBufferValue, 2);
	}

	brushSliderInput.addEventListener("input", setBrushSize);
	brushNumberInput.addEventListener("input", setBrushSize);

	uiBufferValue.set([5], 2);
	device.queue.writeBuffer(uiBuffer, SIZE.vec2, uiBufferValue, 2);
	// FPS
	const fpsSliderInput = document.getElementById(
		"fps-slider",
	) as HTMLInputElement;
	const fpsNumberInput = document.getElementById(
		"fps-number",
	) as HTMLInputElement;

	function onFPSEvent(event: InputEvent) {
		let value = (event.target as HTMLInputElement).value;
		let clamped = Math.max(0, Math.min(parseInt(value ? value : "0"), 60));
		fpsSliderInput.value = clamped.toString();
		fpsNumberInput.value = clamped.toString();

		changeFPS(clamped);
	}
	fpsSliderInput.addEventListener("input", onFPSEvent);
	fpsNumberInput.addEventListener("input", onFPSEvent);
}

await main();

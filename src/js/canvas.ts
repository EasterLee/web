import shaderSource from "./shader.wgsl?raw"; // Vite

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const context = canvas.getContext("webgpu") as GPUCanvasContext;

const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

class MyGPU {
	adapter!: GPUAdapter;
	device!: GPUDevice;

	pipeline!: GPURenderPipeline;
	renderPassDescriptor!: GPURenderPassDescriptor;
	constructor() {}
	async init() {
		this.adapter = (await navigator.gpu?.requestAdapter()) as GPUAdapter;
		this.device = (await this.adapter?.requestDevice({
			requiredFeatures: ["timestamp-query"],
		})) as GPUDevice;
		if (!this.device) {
			throw new Error("need a browser that supports WebGPU");
		}
	}

	setUpPipeline() {
		const module = this.device.createShaderModule({
			label: "our hardcoded red triangle shaders",
			code: shaderSource,
		});

		const pipeline = this.device.createRenderPipeline({
			label: "our hardcoded red triangle pipeline",
			layout: "auto",
			vertex: {
				module,
			},
			fragment: {
				module,
				targets: [
					{
						format: presentationFormat,
					},
				],
			},
		});

		this.pipeline = pipeline;
	}
	setUpRenderPassDescriptor() {
		const renderPassDescriptor: GPURenderPassDescriptor = {
			label: "our basic canvas renderPass",
			colorAttachments: [
				{
					view: undefined as unknown as GPUTextureView,
					clearValue: [0.3, 0.3, 0.3, 1],
					loadOp: "clear",
					storeOp: "store",
				},
			],
		};
		this.renderPassDescriptor = renderPassDescriptor;
	}
	initBuffer() {
		uiBuffer = myGPU.device.createBuffer({
			label: `uiBuffer`,
			size: uiBufferSize,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		particleBuffer = myGPU.device.createBuffer({
			label: `particleBuffer`,
			size: particleBufferValue.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		bindGroup = myGPU.device.createBindGroup({
			label: "bind group for objects",
			layout: myGPU.pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: uiBuffer },
				{ binding: 1, resource: particleBuffer },
			],
		});
	}

	render() {
		// Get the current texture from the canvas context and
		// set it as the texture to render to.
		this.renderPassDescriptor.colorAttachments[0]!.view = context
			.getCurrentTexture()
			.createView();

		// make a command encoder to start encoding commands
		const encoder = this.device.createCommandEncoder({ label: "our encoder" });

		// make a render pass encoder to encode render specific commands
		const pass = timingHelper.beginRenderPass(
			encoder,
			this.renderPassDescriptor,
		);
		pass.setPipeline(this.pipeline);

		//myGPU.device.queue.writeBuffer(particleBuffer, 0, particleBufferValue);

		pass.setBindGroup(0, bindGroup);

		if (particleIndex) pass.draw(6, particleIndex);

		pass.end();

		const commandBuffer = encoder.finish();
		this.device.queue.submit([commandBuffer]);

		timingHelper.getResult().then((gpuTime) => {
			gpuAverage.addSample(gpuTime / 1000);
		});
	}
}

/*

Canvas

*/
function initCanvas(device: GPUDevice) {
	function resizeCanvas() {
		canvas.style.width = "100dvw";
		canvas.style.height = "100dvh";
		canvas.width = canvas.clientWidth * devicePixelRatio;
		canvas.height = canvas.clientHeight * devicePixelRatio;
		context.configure({
			device,
			format: presentationFormat,
		});

		uiBufferValue.set([canvas.width, canvas.height]);
		myGPU.device.queue.writeBuffer(uiBuffer, 0, uiBufferValue);
		const depthStencilTexture = myGPU.device.createTexture({
			label: "depth stencil texture",
			size: [canvas.width, canvas.height],
			format: "depth24plus-stencil8",
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});
		if (myGPU.renderPassDescriptor?.depthStencilAttachment)
			myGPU.renderPassDescriptor.depthStencilAttachment.view =
				depthStencilTexture.createView();
		// myGPU.render();
	}
	resizeCanvas();
	window.addEventListener("resize", resizeCanvas);
}

const myGPU = new MyGPU();

let uiBuffer: GPUBuffer;
let uiBufferValue = new Float32Array(4);
let uiBufferSize = 2 * 4 + 8; //width + length float + padding

/*
struct Particle {
    color: vec4f,
    pos: vec2f,
    vel: vec2f,
};
*/
let particleBuffer: GPUBuffer;
let particleValueFloatCount = 4 + 2 + 2;
let particleBufferSize = particleValueFloatCount * 4;
let maxParticleCount = 100000;
let particleBufferValue = new Float32Array(
	(particleBufferSize / 4) * maxParticleCount,
);

let particleIndex = 10000;
function addParticle(x: number, y: number) {
	particleBufferValue.set(
		[1, 1, 1, 1, x, y, 0, 0],
		particleValueFloatCount * particleIndex,
	);
	myGPU.device.queue.writeBuffer(particleBuffer, 0, particleBufferValue);
	particleIndex++;
	window.pi = particleIndex;
}

import TimingHelper from "https://webgpufundamentals.org/webgpu/resources/js/timing-helper.js";
import NonNegativeRollingAverage from "https://webgpufundamentals.org/webgpu/resources/js/non-negative-rolling-average.js";
const gpuAverage = new NonNegativeRollingAverage();
let timingHelper;

// Mouse
canvas.addEventListener("mousedown", (event) => {
	for (let i = 0; i < 100; i++) addParticle(event.x, event.y);
});

let bindGroup: GPUBindGroup;

async function main() {
	await myGPU.init();
	myGPU.setUpPipeline();
	myGPU.initBuffer();
	initCanvas(myGPU.device);
	myGPU.setUpRenderPassDescriptor();

	timingHelper = new TimingHelper(myGPU.device);

	lastTime = performance.now();
	requestAnimationFrame(animate);
}

let lastTime = 0;
function animate() {
	window.g = (gpuAverage.get() / 1000).toFixed(1);
	myGPU.render();
	requestAnimationFrame(animate);
}

main();

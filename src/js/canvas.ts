// // description: This example demonstrates how to use a Container to group and manipulate multiple sprites

// import * as PIXI from "pixi.js";

// // Create a new application
// const app = new PIXI.Application();

// // Initialize the application
// await app.init({ background: "#1099bb", resizeTo: window });

// // Append the application canvas to the document body
// document.body.appendChild(app.canvas);

// const texture = PIXI.Texture.from({
// 	resource: new Uint8Array(4 * 5 * 5).fill(255),
// 	width: 5,
// 	height: 5,
// });

// const container = new PIXI.ParticleContainer({
// 	dynamicProperties: {
// 		position: false, // default
// 		vertex: false,
// 		rotation: false,
// 		color: true,
// 	},
// });

// var mouse: PIXI.Point;
// app.stage.eventMode = "static";
// app.stage.hitArea = app.screen;
// app.stage.on("mousemove", (e: PIXI.FederatedPointerEvent) => {
// 	//console.log(e);
// 	mouse = e.global;
// });

// app.stage.addChild(container);

// interface ParticleOptions extends PIXI.ParticleOptions {
// 	vx?: number;
// 	vy?: number;
// 	life?: number;
// }

// interface IParticle extends PIXI.IParticle {
// 	vx?: number;
// 	vy?: number;
// 	life?: number;
// }

// class Particle extends PIXI.Particle implements IParticle {
// 	vx: number = 0;
// 	vy: number = 0;
// 	life: number = 5000;
// 	constructor(
// 		options: PIXI.Texture<PIXI.TextureSource<any>> | ParticleOptions,
// 	) {
// 		super(options);
// 		if (options instanceof PIXI.Texture) return;
// 		const { vx, vy, life } = options;
// 		this.vx = vx ?? this.vx;
// 		this.vy = vy ?? this.vy;
// 		this.life = life ?? this.life;
// 	}
// }

// app.ticker.add((ticker) => {
// 	window.dt = ticker.deltaMS;
// 	if (!mouse) return;
// 	for (let i = 0; i < 100; i++) {
// 		container.addParticle(
// 			new Particle({
// 				texture,
// 				x: mouse.x + (Math.random() - 0.5) * 100,
// 				y: mouse.y + (Math.random() - 0.5) * 100,
// 				vx: (Math.random() - 0.5) * 1,
// 				vy: (Math.random() - 0.5) * 1,
// 			}),
// 		);
// 	}

// 	for (let i = container.particleChildren.length - 1; i >= 0; i--) {
// 		let p = container.particleChildren[i] as Particle;

// 		p.life -= ticker.deltaMS;
// 		if (p.life <= 0) {
// 			container.removeParticleAt(i);
// 			continue;
// 		}

// 		p.y += p.vy;
// 		p.x += p.vx;
// 		p.color = 0xff0000ff;
// 		p.scaleX += (Math.random() - 0.5) * 0.1;
// 		p.scaleY += (Math.random() - 0.5) * 0.1;
// 	}
// });

// window.app = app;\

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
		this.device = (await this.adapter?.requestDevice()) as GPUDevice;
		if (!this.device) {
			throw new Error("need a browser that supports WebGPU");
		}

		this.setUpPipeline();
		this.setUpRenderPassDescriptor();
	}

	setUpPipeline() {
		const module = this.device.createShaderModule({
			label: "our hardcoded red triangle shaders",
			code: /* wgsl */ `

			struct VertexOutput {
				@builtin(position) pos: vec4f,
				@location(0) uv: vec2f,
			}
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> VertexOutput {
        let pos = array(
          VertexOutput(vec4f(-0.5, -0.5, 0.0, 1.0), vec2f(0, 0)),  // bottom left
          VertexOutput(vec4f(-0.5, 0.5, 0.0, 1.0), vec2f(0, 1)),  // top left
          VertexOutput(vec4f(0.5, -0.5, 0.0, 1.0), vec2f(1, 0)),  // bottom right

		  
          VertexOutput(vec4f(0.5, 0.5, 0.0, 1.0), vec2f(1, 1)),  // top right
          VertexOutput(vec4f(-0.5, 0.5, 0.0, 1.0), vec2f(0, 1)),  // top left
          VertexOutput(vec4f(0.5, -0.5, 0.0, 1.0), vec2f(1, 0))  // bottom right
        );
 
        return pos[vertexIndex];
      }
 
      @fragment fn fs(out: VertexOutput) -> @location(0) vec4f {
		let centered = out.uv * 2.0 - vec2f(1.0, 1.0);

		if (dot(centered, centered) > 1) {
			discard;
		}
        return vec4f(1.0, 0.0, 0.0, 1.0);
      }
    `,
		});

		const pipeline = this.device.createRenderPipeline({
			label: "our hardcoded red triangle pipeline",
			layout: "auto",
			vertex: {
				module,
			},
			fragment: {
				module,
				targets: [{ format: presentationFormat }],
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

	render() {
		// Get the current texture from the canvas context and
		// set it as the texture to render to.
		this.renderPassDescriptor.colorAttachments[0]!.view = context
			.getCurrentTexture()
			.createView();

		// make a command encoder to start encoding commands
		const encoder = this.device.createCommandEncoder({ label: "our encoder" });

		// make a render pass encoder to encode render specific commands
		const pass = encoder.beginRenderPass(this.renderPassDescriptor);
		pass.setPipeline(this.pipeline);
		pass.draw(6); // call our vertex shader 3 times
		pass.end();

		const commandBuffer = encoder.finish();
		this.device.queue.submit([commandBuffer]);
	}
}

function initCanvas(device: GPUDevice) {
	function resizeCanvas() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		context.configure({
			device,
			format: presentationFormat,
		});
		myGPU.render();
	}
	resizeCanvas();
	window.addEventListener("resize", resizeCanvas);
}

const myGPU = new MyGPU();
async function main() {
	await myGPU.init();

	initCanvas(myGPU.device);

	myGPU.render();
}

main();

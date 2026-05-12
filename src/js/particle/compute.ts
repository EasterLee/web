import TypeSize from "./const";
import computeShader from "./shaders/compute/compute_shader.wgsl?raw"; // Vite
async function main() {
	const adapter = (await navigator.gpu?.requestAdapter()) as GPUAdapter;
	const device = (await adapter?.requestDevice({
		requiredFeatures: ["timestamp-query"],
	})) as GPUDevice;
	if (!device) {
		throw new Error("need a browser that supports WebGPU");
	}

	const module = device.createShaderModule({
		label: "compute shaders",
		code: computeShader,
	});

	const pipeline = device.createComputePipeline({
		label: "our hardcoded red triangle pipeline",
		layout: "auto",
		compute: {
			module: module,
		},
	});

	const bufferValue = new Float32Array(
		new Array(1000).fill(0).map((v, i) => {
			return i;
		}),
	);
	console.log(bufferValue);
	const buffer = device.createBuffer({
		size: bufferValue.byteLength,
		usage:
			GPUBufferUsage.STORAGE |
			GPUBufferUsage.COPY_SRC |
			GPUBufferUsage.COPY_DST,
	});
	device.queue.writeBuffer(buffer, 0, bufferValue);

	const readBuffer = device.createBuffer({
		size: bufferValue.byteLength,
		usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
	});

	const bindGroup = device.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [{ binding: 0, resource: buffer }],
	});

	const indirectBuffer = device.createBuffer({
		size: 3 * 4,
		usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
	})

	function emit() {
		const encoder = device.createCommandEncoder({
			label: "compute builtin encoder emit",
		});
		const pass = encoder.beginComputePass({ label: "compute builtin pass emit" });

		pass.setPipeline(pipeline);
		pass.setBindGroup(0, bindGroup);
		pass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
		pass.end();
		encoder.copyBufferToBuffer(buffer, 0, readBuffer, 0);
		const commandBuffer = encoder.finish();
		device.queue.submit([commandBuffer]);
	}
	function operate() {
		const encoder = device.createCommandEncoder({
			label: "compute builtin encoder operate",
		});
		const pass = encoder.beginComputePass({ label: "compute builtin pass operate" });

		pass.setPipeline(pipeline);
		pass.setBindGroup(0, bindGroup);
		pass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
		pass.end();

		encoder.copyBufferToBuffer(buffer, 0, readBuffer, 0);
		const commandBuffer = encoder.finish();
		device.queue.submit([commandBuffer]);
	}

	// await readBuffer.mapAsync(GPUMapMode.READ);
	// const result = new Float32Array(readBuffer.getMappedRange());
	// console.log(result);
}

await main();

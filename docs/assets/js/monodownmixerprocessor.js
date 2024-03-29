//
// MIT License
//
// Copyright (c) 2021 Carlos Rafael Gimenes das Neves
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// https://github.com/carlosrafaelgn/FPlayWeb
//

class MonoDownMixerProcessor extends AudioWorkletProcessor {
	// https://developer.mozilla.org/en-US/docs/Web/API/AudioParam#k-rate
	static get parameterDescriptors () {
		return [{
			name: "multiplier",
			defaultValue: 0.5,
			minValue: 0,
			maxValue: 1,
			automationRate: "k-rate"
		}];
	}

	// https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process
	// process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: { [key: string]: Float32Array }): boolean
	process(inputs, outputs, parameters) {
		// Unlike Firefox, Chrome stops calling process() forever as soon as false is returned!
		const input = inputs[0];

		if (!input || !input.length)
			return true;

		const inputL = input[0],
			inputR = input[1],
			output = outputs[0],
			outputL = output[0],
			outputR = output[1],
			m = parameters["multiplier"][0];

		for (let i = inputL.length - 1; i >= 0; i--) {
			const o = m * (inputL[i] + inputR[i]);
			outputL[i] = o;
			outputR[i] = o;
		}

		return true;
	}
}

registerProcessor("monodownmixerprocessor", MonoDownMixerProcessor);

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

class MonoDownMixerControl extends ConnectableNode {
	public static isSupported(): boolean {
		// Should we also check for HTTPS? Because, apparently, the browser already undefines
		// AudioWorklet when not serving the files from a secure origin...
		return (("AudioWorklet" in window) && ("AudioWorkletNode" in window));
	}

	private readonly audioContext: AudioContext;

	private _multiplier: number;
	private audioNode: AudioWorkletNode | null;
	private loading: boolean;
	private loaded: boolean;
	private desiredEnabled: boolean;

	public constructor(audioContext: AudioContext) {
		super();

		this._multiplier = 0.5;
		this.audioContext = audioContext;
		this.audioNode = null;
		this.loading = false;
		this.loaded = false;
		this.desiredEnabled = false;
	}

	protected get input(): AudioNode | null {
		return this.audioNode;
	}

	protected get output(): AudioNode | null {
		return this.audioNode;
	}

	public get enabled(): boolean {
		// Overriding only the getter, or only the setter, does not work in all browsers
		return super.enabled;
	}

	public set enabled(enabled: boolean) {
		if (!MonoDownMixerControl.isSupported())
			enabled = false;

		this.desiredEnabled = enabled;

		if (this.audioNode) {
			super.enabled = enabled;
		} else if (enabled) {
			if (this.loaded)
				this.createAudioNode();
			else
				this.load();
		}
	}

	public get multiplier(): number {
		return this._multiplier;
	}

	public set multiplier(multiplier: number) {
		this._multiplier = multiplier;

		if (this.audioNode)
			(this.audioNode.parameters as any).get("multiplier").value = multiplier;
	}

	private showError(step: string, reason: any): void {
		Alert.show("Error while " + step + ": " + (reason ? (reason.message || reason.toString()) : "Unknown error"), true);
	}

	private load(): void {
		if (this.loading || this.loaded || !this.audioContext)
			return;

		this.loading = true;

		addAudioWorkletModule(this.audioContext, "assets/js/monodownmixerprocessor.js?" + (window as any).CACHE_VERSION).then(() => {
			this.loading = false;
			this.loaded = true;
			this.createAudioNode();
		}, (reason) => {
			this.showError("loading the mono down-mixer script", reason);
		});
	}

	private createAudioNode(): void {
		// https://webaudio.github.io/web-audio-api/#AudioWorkletNode
		// https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode
		// https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor
		// https://developers.google.com/web/updates/2018/06/audio-worklet-design-pattern
		// https://developer.mozilla.org/en-US/docs/Web/API/AudioParam#a-rate
		// https://developer.mozilla.org/en-US/docs/Web/API/AudioParam#k-rate

		if (!this.loaded)
			return;

		if (this.audioNode) {
			this.audioNode.disconnect();
			this.audioNode = null;
		}

		try {
			const audioNode = new AudioWorkletNode(this.audioContext, "monodownmixerprocessor");

			if (audioNode.numberOfInputs !== 1) {
				super.enabled = false;
				this.showError("creating the mono down-mixer node", "audioNode.numberOfInputs is " + audioNode.numberOfInputs + ", but should be 1");
				return;
			}

			if (audioNode.numberOfOutputs !== 1) {
				super.enabled = false;
				this.showError("creating the mono down-mixer node", "audioNode.numberOfOutputs is " + audioNode.numberOfOutputs + ", but should be 1");
				return;
			}

			if (audioNode.channelCount !== 2) {
				super.enabled = false;
				this.showError("creating the mono down-mixer node", "audioNode.channelCount is " + audioNode.channelCount + ", but should be 2");
				return;
			}

			this.audioNode = audioNode;

			audioNode.onprocessorerror = (ev) => {
				if (this.audioNode && this.audioNode === audioNode) {
					audioNode.disconnect();
					super.enabled = false;
					this.audioNode = null;
					this.showError("processing the mono down-mixer", ev);
				}
			};

			(audioNode.parameters as any).get("multiplier").value = this._multiplier;

			super.enabled = this.desiredEnabled;
		} catch (ex: any) {
			super.enabled = false;

			this.showError("creating the mono down-mixer node", ex);
		}
	}
}

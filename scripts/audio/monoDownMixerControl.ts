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

	private readonly _audioContext: AudioContext;

	private _multiplier: number;
	private _audioNode: AudioWorkletNode | null;
	private _loading: boolean;
	private _loaded: boolean;
	private _desiredEnabled: boolean;

	public constructor(audioContext: AudioContext) {
		super();

		this._multiplier = 0.5;
		this._audioContext = audioContext;
		this._audioNode = null;
		this._loading = false;
		this._loaded = false;
		this._desiredEnabled = false;
	}

	protected get input(): AudioNode | null {
		return this._audioNode;
	}

	protected get output(): AudioNode | null {
		return this._audioNode;
	}

	public get enabled(): boolean {
		// Overriding only the getter, or only the setter, does not work in all browsers
		return super.enabled;
	}

	public set enabled(enabled: boolean) {
		if (!MonoDownMixerControl.isSupported())
			enabled = false;

		this._desiredEnabled = enabled;

		if (this._audioNode) {
			super.enabled = enabled;
		} else if (enabled) {
			if (this._loaded)
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

		if (this._audioNode)
			(this._audioNode.parameters as any).get("multiplier").value = multiplier;
	}

	private showError(step: string, reason: any): void {
		Alert.show("Error while " + step + ": " + (reason ? (reason.message || reason.toString()) : "Unknown error"), true);
	}

	private load(): void {
		if (this._loading || this._loaded || !this._audioContext)
			return;

		this._loading = true;

		addAudioWorkletModule(this._audioContext, "assets/js/monodownmixerprocessor.js?" + (window as any).CACHE_VERSION).then(() => {
			this._loading = false;
			this._loaded = true;
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

		if (!this._loaded)
			return;

		if (this._audioNode) {
			this._audioNode.disconnect();
			this._audioNode = null;
		}

		try {
			const audioNode = new AudioWorkletNode(this._audioContext, "monodownmixerprocessor");

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

			this._audioNode = audioNode;

			audioNode.onprocessorerror = (e) => {
				if (this._audioNode && this._audioNode === audioNode) {
					audioNode.disconnect();
					super.enabled = false;
					this._audioNode = null;
					this.showError("processing the mono down-mixer", e);
				}
			};

			(audioNode.parameters as any).get("multiplier").value = this._multiplier;

			super.enabled = this._desiredEnabled;
		} catch (ex: any) {
			super.enabled = false;

			this.showError("creating the mono down-mixer node", ex);
		}
	}
}

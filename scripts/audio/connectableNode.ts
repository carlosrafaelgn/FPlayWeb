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

abstract class ConnectableNode {
	private _enabled: boolean;

	private _previous: ConnectableNode | null;
	private _next: ConnectableNode | null;

	public constructor() {
		this._enabled = false;
		this._previous = null;
		this._next = null;
	}

	protected abstract get input(): AudioNode | null;
	protected abstract get output(): AudioNode | null;

	private get actualInput(): AudioNode | null {
		return (this._enabled ? this.input : (this._next ? this._next.actualInput : null));
	}

	private get actualOutput(): AudioNode | null {
		return (this._enabled ? this.output : (this._previous ? this._previous.actualOutput : null));
	}

	protected nodesChanged(): void {
		const previous = this._previous,
			next = this._next;

		if (previous)
			previous.disconnectFromDestination();

		if (next)
			this.disconnectFromDestination();

		if (previous)
			previous.connectToDestination(this);

		if (next)
			this.connectToDestination(next);
	}

	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(enabled: boolean) {
		if (this._enabled === enabled)
			return;

		this._enabled = enabled;

		this.nodesChanged();
	}

	public connectToDestination(destination: ConnectableNode | null): void {
		this.disconnectFromDestination();

		this._next = destination;

		if (destination) {
			destination._previous = this;

			const actualOutput = this.actualOutput;
			if (actualOutput) {
				const actualInput = destination.actualInput;
				if (actualInput)
					actualOutput.connect(actualInput);
			}
		}
	}

	public disconnectFromDestination(): void {
		const actualOutput = this.actualOutput;
		if (actualOutput)
			actualOutput.disconnect();

		if (this._next) {
			this._next._previous = null;
			this._next = null;
		}
	}
}

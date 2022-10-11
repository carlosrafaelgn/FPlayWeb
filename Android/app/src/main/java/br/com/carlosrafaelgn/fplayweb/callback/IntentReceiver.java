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
package br.com.carlosrafaelgn.fplayweb.callback;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.webkit.WebView;

import br.com.carlosrafaelgn.fplayweb.WebViewHost;

public final class IntentReceiver extends BroadcastReceiver {
	private boolean noisyIntentUnregistered = true;

	private final WebViewHost webViewHost;

	public IntentReceiver(WebViewHost webViewHost) {
		this.webViewHost = webViewHost;
	}

	public void syncNoisyRegistration(boolean paused) {
		if (noisyIntentUnregistered == paused)
			return;

		noisyIntentUnregistered = paused;

		if (paused)
			webViewHost.application.unregisterReceiver(this);
		else
			webViewHost.application.registerReceiver(this, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
	}

	@Override
	public void onReceive(Context context, Intent intent) {
		final WebView webView = webViewHost.webView;

		if (webView != null)
			webView.evaluateJavascript("App.player && App.player.pause()", null);
	}
}

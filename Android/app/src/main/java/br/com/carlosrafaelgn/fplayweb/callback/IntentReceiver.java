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

import android.annotation.SuppressLint;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.os.Build;
import android.webkit.WebView;

import br.com.carlosrafaelgn.fplayweb.MainApplication;
import br.com.carlosrafaelgn.fplayweb.WebViewHost;

public final class IntentReceiver extends BroadcastReceiver {
	private final WebViewHost webViewHost;

	@SuppressWarnings("unused")
	public IntentReceiver() {
		// Used by Android itself to dispatch notification actions when Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
		webViewHost = null;
	}

	@SuppressLint("UnspecifiedRegisterReceiverFlag")
	public IntentReceiver(WebViewHost webViewHost) {
		this.webViewHost = webViewHost;

		final IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
		filter.addAction(WebViewHost.ACTION_PAUSE);
		filter.addAction(WebViewHost.ACTION_PREV);
		filter.addAction(WebViewHost.ACTION_PLAY);
		filter.addAction(WebViewHost.ACTION_PLAY_PAUSE);
		filter.addAction(WebViewHost.ACTION_NEXT);
		filter.addAction(WebViewHost.ACTION_EXIT);

		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
			webViewHost.application.registerReceiver(this, filter, Context.RECEIVER_EXPORTED);
		else
			webViewHost.application.registerReceiver(this, filter);
	}

	public void destroy() {
		webViewHost.application.unregisterReceiver(this);
	}

	@Override
	public void onReceive(Context context, Intent intent) {
		WebView webView = null;

		if (webViewHost == null) {
			final Context applicationContext = context.getApplicationContext();
			if (applicationContext instanceof MainApplication) {
				final MainApplication application = (MainApplication)applicationContext;
				final WebViewHost webViewHost = application.webViewHost;
				if (webViewHost != null)
					webView = webViewHost.webView;
			}
		} else {
			webView = webViewHost.webView;
		}

		if (intent == null || webView == null)
			return;

		final String action = intent.getAction();
		if (action == null)
			return;

		switch (action) {
		case AudioManager.ACTION_AUDIO_BECOMING_NOISY:
			webView.evaluateJavascript("App.player && App.player.headsetRemoved()", null);
			break;
		case WebViewHost.ACTION_PAUSE:
			webView.evaluateJavascript("App.player && App.player.pause()", null);
			break;
		case WebViewHost.ACTION_PREV:
			webView.evaluateJavascript("App.player && App.player.previous()", null);
			break;
		case WebViewHost.ACTION_PLAY:
			webView.evaluateJavascript("App.player && App.player.play()", null);
			break;
		case WebViewHost.ACTION_PLAY_PAUSE:
			webView.evaluateJavascript("App.player && App.player.playPause()", null);
			break;
		case WebViewHost.ACTION_NEXT:
			webView.evaluateJavascript("App.player && App.player.next()", null);
			break;
		case WebViewHost.ACTION_EXIT:
			webView.evaluateJavascript("App.player && App.exit()", null);
			break;
		}
	}
}

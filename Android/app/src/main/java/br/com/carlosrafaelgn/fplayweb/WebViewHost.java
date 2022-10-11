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
package br.com.carlosrafaelgn.fplayweb;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.content.res.Resources;
import android.graphics.PixelFormat;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import br.com.carlosrafaelgn.fplayweb.callback.HostMediaSession;
import br.com.carlosrafaelgn.fplayweb.callback.IntentReceiver;
import br.com.carlosrafaelgn.fplayweb.list.FileFetcher;
import br.com.carlosrafaelgn.fplayweb.list.FileSt;
import br.com.carlosrafaelgn.fplayweb.util.JsonBuilder;

public class WebViewHost {
	// https://developer.android.com/guide/webapps/webview
	// https://developer.android.com/reference/android/webkit/WebView#postWebMessage(android.webkit.WebMessage,%20android.net.Uri)

	// https://github.com/Red-Folder/bgs-core/issues/17
	// https://stackoverflow.com/a/52030464/3569421
	// https://stackoverflow.com/a/47872802/3569421
	// Is this class mentioned above really necessary nowadays...?

	public static final int BACK_KEY_DESTROY = 0;
	public static final int BACK_KEY_PREVENT = 1;
	public static final int BACK_KEY_MOVE_TO_BACK = 2;

	private static final String INITIAL_URL = "file:///android_asset/index.html";

	private static boolean hostAlive = false;

	// Calling onReceiveValue(null) or onReceiveValue(new Uri[0]) makes
	// the "dialog" be cancelled, thus, not triggering fileInput.onchange
	private static Uri[] canceledFilePathCallbackUris() {
		return new Uri[] { Uri.parse(INITIAL_URL) };
	}

	@SuppressWarnings("unused")
	private final class LibWebViewJavaScriptInterface {
		private final Object lock = new Object();
		private final String browserLanguage;
		private final double fontScale;
		private final Handler handler;

		private final IntentReceiver intentReceiver;
		private final HostMediaSession hostMediaSession;

		private boolean alive;
		private ValueCallback<Uri[]> filePathCallback;
		private FileFetcher fileFetcher;

		public boolean paused;

		LibWebViewJavaScriptInterface(String browserLanguage, double fontScale) {
			alive = true;
			paused = true;
			this.browserLanguage = browserLanguage;
			this.fontScale = fontScale;
			handler = new Handler(Looper.getMainLooper());
			intentReceiver = new IntentReceiver(WebViewHost.this);
			hostMediaSession = new HostMediaSession(WebViewHost.this);
		}

		@JavascriptInterface
		public String getHostType() {
			return "Android";
		}

		@JavascriptInterface
		public String getBrowserLanguage() {
			return browserLanguage;
		}

		@JavascriptInterface
		public double getFontScale() {
			return fontScale;
		}

		@JavascriptInterface
		public void setPaused(final boolean paused) {
			handler.post(() -> {
				synchronized (lock) {
					if (!alive || this.paused == paused)
						return;

					this.paused = paused;
				}

				intentReceiver.syncNoisyRegistration(paused);

				hostMediaSession.setPaused(paused);
			});
		}

		@JavascriptInterface
		public void setLoading(final boolean loading) {
			handler.post(() -> {
				synchronized (lock) {
					if (!alive)
						return;
				}

				hostMediaSession.setLoading(loading);
			});
		}

		@JavascriptInterface
		public void setMetadata(final long id, final String title, final String artist, final String album, final int track, final long lengthMS, final int year) {
			handler.post(() -> {
				synchronized (lock) {
					if (!alive)
						return;
				}

				hostMediaSession.setMetadata(id, title, artist, album, track, lengthMS, year);
			});
		}

		@JavascriptInterface
		public int checkFilePermission() {
			return ((application.checkSelfPermission(Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? Manifest.permission.READ_MEDIA_AUDIO : Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED) ? 1 : 0);
		}

		@JavascriptInterface
		public void requestFilePermission() {
			handler.post(() -> {
				if (activity != null) {
					pendingPermissionRequestResult = true;
					activity.requestPermissions(new String[] { Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? Manifest.permission.READ_MEDIA_AUDIO : Manifest.permission.READ_EXTERNAL_STORAGE }, 0);
				} else {
					postCallbackPermissionResult(0);
				}
			});
		}

		@JavascriptInterface
		public void setFileURLs(String[] fileURLs) {
			final ValueCallback<Uri[]> filePathCallback;

			synchronized (lock) {
				if (!alive)
					return;

				filePathCallback = this.filePathCallback;
				this.filePathCallback = null;
			}

			if (filePathCallback == null)
				return;

			Uri[] uris;

			if (fileURLs == null || fileURLs.length == 0) {
				uris = canceledFilePathCallbackUris();
			} else {
				try {
					uris = new Uri[fileURLs.length];

					for (int i = uris.length - 1; i >= 0; i--)
						uris[i] = Uri.parse(fileURLs[i]);
				} catch (Throwable th) {
					uris = canceledFilePathCallbackUris();
				}
			}

			filePathCallback.onReceiveValue(uris);
		}

		@JavascriptInterface
		public void enumerateFiles(int enumerationVersion, String path) {
			synchronized (lock) {
				if (!alive)
					return;

				cancelFileFetcher();

				// cancelFilePathCallback() cannot be called here, because enumerateFiles()
				// is called several times between setFilePathCallback() and setFileURLs() calls

				fileFetcher = new FileFetcher(activity, (path != null && path.length() > 0 && !path.startsWith("/")) ? ("/" + path) : path, enumerationVersion, (fetcher, e) -> {
					synchronized (lock) {
						if (!alive || fileFetcher == null || fileFetcher.version != enumerationVersion)
							return;
					}

					final JsonBuilder jsonBuilder = new JsonBuilder();

					jsonBuilder.appendRawString("FilePickerAndroidProvider.callback && FilePickerAndroidProvider.callback(")
						.value(enumerationVersion)
						.array();

					// File paths should start with "/", but not directory paths!
					if (path == null || path.length() == 0) {
						for (int i = 0; i < fetcher.count; i++) {
							final FileSt file = fetcher.files[i];
							jsonBuilder.value(file.name + "\u0004" + file.path.substring(1), false);
						}
					} else {
						for (int i = 0; i < fetcher.count; i++) {
							final FileSt file = fetcher.files[i];
							jsonBuilder.value(file.isDirectory ? file.path.substring(1) : file.path, false);
						}
					}

					jsonBuilder.endArray()
						.appendRawString(");");

					handler.post(() -> {
						synchronized (lock) {
							if (!alive || fileFetcher == null || fileFetcher.version != enumerationVersion)
								return;

							fileFetcher = null;
						}

						final WebView webView = WebViewHost.this.webView;

						if (webView != null)
							webView.evaluateJavascript(jsonBuilder.toString(), null);
					});
				}, null, false);
			}
		}

		// Must only be called from within a synchronized (lock) { } block
		private void cancelFileFetcher() {
			if (fileFetcher != null) {
				final int enumerationVersion = fileFetcher.version;

				fileFetcher.cancel();
				fileFetcher = null;

				handler.post(() -> {
					final WebView webView = WebViewHost.this.webView;

					if (webView != null)
						webView.evaluateJavascript("FilePickerAndroidProvider.callback && FilePickerAndroidProvider.callback(" + enumerationVersion + ", null);", null);
				});
			}
		}

		// Must only be called from within a synchronized (lock) { } block
		private void cancelFilePathCallback() {
			if (filePathCallback != null) {
				filePathCallback.onReceiveValue(canceledFilePathCallbackUris());
				filePathCallback = null;
			}
		}

		@JavascriptInterface
		public void cancelFileEnumeration(int enumerationVersion) {
			synchronized (lock) {
				if (!alive)
					return;

				if (fileFetcher != null && fileFetcher.version == enumerationVersion)
					cancelFileFetcher();

				cancelFilePathCallback();
			}
		}

		public void cancelFileEnumerationInternal() {
			synchronized (lock) {
				if (!alive)
					return;

				cancelFileFetcher();

				cancelFilePathCallback();
			}
		}

		public boolean setFilePathCallback(ValueCallback<Uri[]> filePathCallback) {
			synchronized (lock) {
				if (!alive)
					return false;

				cancelFilePathCallback();

				this.filePathCallback = filePathCallback;

				handler.post(() -> {
					synchronized (lock) {
						if (!alive || this.filePathCallback != filePathCallback)
							return;
					}

					final WebView webView = WebViewHost.this.webView;

					if (webView != null)
						webView.evaluateJavascript("FilePickerAndroidProvider.callbackClickDone && FilePickerAndroidProvider.callbackClickDone()", null);
				});

				return true;
			}
		}

		public void destroy() {
			synchronized (lock) {
				if (!alive)
					return;

				alive = false;

				filePathCallback = null;

				if (fileFetcher != null) {
					fileFetcher.cancel();
					fileFetcher = null;
				}

				intentReceiver.syncNoisyRegistration(true);

				hostMediaSession.destroy();
			}
		}
	}

	private final class LibWebViewClient extends WebViewClient {
		@SuppressWarnings("deprecation")
		@Override
		public boolean shouldOverrideUrlLoading(WebView view, String url) {
			try {
				if (url.startsWith("http")) {
					final Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
					intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
					application.startActivity(intent);
					return true;
				}
			} catch (Throwable th) {
				// Just ignore...
			}
			return false;
		}

		@Override
		public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
			return shouldOverrideUrlLoading(null, request.getUrl().toString());
		}
	}

	private final class LibWebChromeClient extends WebChromeClient {
		@Override
		public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
			return false;
		}

		@Override
		public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
			if (message == null || message.length() == 0 || activity == null)
				return false;

			final AlertDialog alertDialog = new AlertDialog.Builder(activity)
				.setMessage(message)
				.setCancelable(true)
				.setPositiveButton(R.string.ok, null)
				.setTitle(R.string.app_name)
				.create();

			alertDialog.setCanceledOnTouchOutside(false);
			alertDialog.setOnDismissListener(dialog -> result.confirm());
			alertDialog.show();

			return true;
		}

		@Override
		public boolean onJsBeforeUnload(WebView view, String url, String message, final JsResult result) {
			if (activity == null)
				return false;

			final boolean[] ok = new boolean[1];
			final AlertDialog alertDialog = new AlertDialog.Builder(activity)
				.setMessage(R.string.confirm_quit)
				.setCancelable(true)
				.setPositiveButton(R.string.ok, (dialog, which) -> {
					ok[0] = true;
					result.confirm();
				})
				.setNegativeButton(R.string.cancel, null)
				.setTitle(R.string.app_name)
				.create();

			alertDialog.setCanceledOnTouchOutside(false);
			alertDialog.setOnDismissListener(dialog -> {
				if (!ok[0])
					result.cancel();
			});
			alertDialog.show();

			return true;
		}

		@Override
		public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
			if (message == null || message.length() == 0 || activity == null)
				return false;

			final boolean[] ok = new boolean[1];
			final AlertDialog alertDialog = new AlertDialog.Builder(activity)
				.setMessage(message)
				.setCancelable(true)
				.setPositiveButton(R.string.ok, (dialog, which) -> {
					ok[0] = true;
					result.confirm();
				})
				.setNegativeButton(R.string.cancel, null)
				.setTitle(R.string.app_name)
				.create();

			alertDialog.setCanceledOnTouchOutside(false);
			alertDialog.setOnDismissListener(dialog -> {
				if (!ok[0])
					result.cancel();
			});
			alertDialog.show();

			return true;
		}

		@Override
		public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, final JsPromptResult result) {
			if (activity == null)
				return false;

			LinearLayout linearLayout = new LinearLayout(activity);
			linearLayout.setOrientation(LinearLayout.VERTICAL);

			final int padding = dpToPxI(16);
			linearLayout.setPadding(padding, padding, padding, padding);

			if (message != null && message.length() > 0) {
				final TextView lbl = new TextView(activity);
				lbl.setText(message);
				final LinearLayout.LayoutParams layoutParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
				layoutParams.bottomMargin = padding >> 1;
				linearLayout.addView(lbl, layoutParams);
			}

			final EditText txt = new EditText(activity);
			txt.setMaxLines(1);
			txt.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
			if (defaultValue != null && defaultValue.length() > 0)
				txt.setText(defaultValue);
			linearLayout.addView(txt, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

			final boolean[] ok = new boolean[1];
			final AlertDialog alertDialog = new AlertDialog.Builder(activity)
				.setView(linearLayout)
				.setCancelable(true)
				.setPositiveButton(R.string.ok, (dialog, which) -> {
					ok[0] = true;
					result.confirm(txt.getText().toString());
				})
				.setNegativeButton(R.string.cancel, null)
				.setTitle(R.string.app_name)
				.create();

			alertDialog.setCanceledOnTouchOutside(false);
			alertDialog.setOnDismissListener(dialog -> {
				if (!ok[0])
					result.cancel();
			});
			alertDialog.setOnShowListener(dialog -> {
				txt.requestFocus();
				txt.selectAll();
			});
			alertDialog.show();

			return true;
		}

		@Override
		public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
			if (filePathCallback == null)
				return false;

			if (webViewJavaScriptInterface == null || !webViewJavaScriptInterface.setFilePathCallback(filePathCallback))
				filePathCallback.onReceiveValue(canceledFilePathCallbackUris());

			return true;
		}

		@Override
		public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
			System.out.println("@@@ " + consoleMessage.sourceId() + ": " + consoleMessage.lineNumber() + " - " + consoleMessage.message());
			return true;
		}

		@Override
		public void onGeolocationPermissionsHidePrompt() {
		}

		@Override
		public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
			callback.invoke(origin, true, true);
		}

		@Override
		public void onPermissionRequest(PermissionRequest request) {
			try {
				request.grant(request.getResources());
			} catch (Throwable th) {
				// Just ignore...
			}
		}

		@Override
		public void onPermissionRequestCanceled(PermissionRequest request) {
		}
	}

	private Activity activity;
	private float density;
	private int floatViewInitialY, floatViewInitialRawY;
	private boolean floatViewMoving, pendingPermissionRequestResult;
	private FrameLayout floatView;
	private LibWebViewJavaScriptInterface webViewJavaScriptInterface;

	public final Application application;
	public WebView webView;

	public WebViewHost(Application application) {
		hostAlive = true;

		this.application = application;

		density = 0;
	}

	public boolean isPaused() {
		final LibWebViewJavaScriptInterface webViewJavaScriptInterface = this.webViewJavaScriptInterface;
		return (webViewJavaScriptInterface == null || webViewJavaScriptInterface.paused);
	}

	public boolean isFloating() {
		return (floatView != null);
	}

	private float getDensity() {
		if (density == 0) {
			final Resources resources = application.getResources();
			final Configuration configuration;
			if (resources != null &&
				(configuration = resources.getConfiguration()) != null &&
				configuration.densityDpi > 0) {
				density = (float)configuration.densityDpi / 160.0f;
			} else {
				return 1.0f;
			}
		}
		return density;
	}

	@SuppressWarnings("SameParameterValue")
	private int dpToPxI(float dp) {
		return (int)((dp * getDensity()) + 0.5f);
	}

	@SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
	public void setActivity(Activity activity) {
		this.activity = activity;

		if (activity == null) {
			if (pendingPermissionRequestResult)
				postCallbackPermissionResult(0);

			if (webViewJavaScriptInterface != null)
				webViewJavaScriptInterface.cancelFileEnumerationInternal();
		} else if (webView == null) {
			WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

			webView = new WebView(application);
			webView.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
			webView.setWebViewClient(new LibWebViewClient());
			webView.setWebChromeClient(new LibWebChromeClient());
			webView.setHorizontalScrollBarEnabled(false);

			final WebSettings settings = webView.getSettings();
			settings.setAllowContentAccess(true);
			settings.setAllowFileAccess(true);
			settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
			settings.setSupportMultipleWindows(false);
			settings.setSupportZoom(false);
			settings.setUseWideViewPort(false);
			settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NORMAL);
			settings.setLoadWithOverviewMode(true);
			settings.setDisplayZoomControls(false);
			settings.setBuiltInZoomControls(false);
			settings.setMediaPlaybackRequiresUserGesture(false);
			settings.setJavaScriptEnabled(true);
			settings.setJavaScriptCanOpenWindowsAutomatically(false);
			settings.setLoadsImagesAutomatically(true);
			settings.setDomStorageEnabled(true);
			settings.setDatabaseEnabled(true);
			settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
			settings.setAllowFileAccessFromFileURLs(true);
			settings.setAllowUniversalAccessFromFileURLs(true);

			final Resources resources = application.getResources();
			final Configuration configuration;
			final double fontScale;
			if (resources != null &&
				(configuration = resources.getConfiguration()) != null &&
				configuration.fontScale > 0) {
				// webView.setInitialScale() changes the entire view (devicePixelRatio)
				fontScale = configuration.fontScale;
			} else {
				fontScale = 1.0;
			}
			// Calling settings.setTextZoom((int)(100 * configuration.fontScale)) does not
			// produce nice results throughout the entire UI, so we set it to 100%, and change
			// the font scale inside the app. We are calling settings.setTextZoom(100) because
			// either Android or the WebView already calls settings.setTextZoom((int)(100 *
			// configuration.fontScale)). Therefore, we must override that value!
			settings.setTextZoom(100);

			webView.addJavascriptInterface(webViewJavaScriptInterface = new LibWebViewJavaScriptInterface(application.getString(R.string.browser_language), fontScale), "hostInterface");

			webView.setBackgroundColor(application.getColor(R.color.colorControlNormal));

			activity.setContentView(webView);

			webView.onResume();
			// https://developer.android.com/reference/android/webkit/WebView#pauseTimers()
			// pauseTimers() affects all WebViews in the process! So, if destroy() is called,
			// which, in turn, calls pauseTimers(), we must call resumeTimers() here!
			webView.resumeTimers();

			webView.loadUrl(INITIAL_URL);
		} else if (floatView != null) {
			floatView.removeAllViews();

			activity.setContentView(webView);
			webView.setVisibility(View.VISIBLE);
			onResume();

			final WindowManager windowManager = (WindowManager)application.getSystemService(Context.WINDOW_SERVICE);
			windowManager.removeView(floatView);

			floatView = null;
		}
	}

	@SuppressLint("ClickableViewAccessibility")
	public boolean enterFloatModeIfPossible() {
		if (webView != null && !webViewJavaScriptInterface.paused && Settings.canDrawOverlays(application)) {
			if (floatView != null)
				return true;

			// https://stackoverflow.com/a/53092436/3569421
			final int width = webView.getWidth();
			final int height = webView.getHeight();
			onPause();
			webView.setVisibility(View.INVISIBLE);

			final ViewGroup parent = (ViewGroup)webView.getParent();
			if (parent != null)
				parent.removeView(webView);

			final WindowManager windowManager = (WindowManager)application.getSystemService(Context.WINDOW_SERVICE);
			final WindowManager.LayoutParams layoutParams = new WindowManager.LayoutParams();

			floatView = new FrameLayout(application);
			floatView.setBackgroundColor(application.getColor(R.color.navigationBarColor));
			floatView.setOnClickListener(v -> {
				// There is a delay of at most 5 seconds between calling startActivity() and the
				// actual start of the activity, if startActivity() is called before at least 5
				// seconds have elapsed since the user pressed the home key. Nowadays, pretty much
				// all workarounds listed at https://stackoverflow.com/q/5600084/3569421 to try to
				// circumvent that behavior fail!
				final Intent intent = new Intent(application, MainActivity.class);
				intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
				application.startActivity(intent);
			});
			floatView.setOnTouchListener((view, event) -> {
				final int index = event.getActionIndex();
				final int pointerId = event.getPointerId(index);

				if (pointerId > 0 || floatView == null)
					return false;

				final int rawY = (int)event.getRawY();

				switch (event.getActionMasked()) {
				case MotionEvent.ACTION_DOWN:
					floatViewMoving = false;
					floatViewInitialY = SharedSettings.floatViewY;
					floatViewInitialRawY = rawY;
					break;

				case MotionEvent.ACTION_MOVE:
					final int deltaRawY = rawY - floatViewInitialRawY;

					if (!floatViewMoving) {
						if (Math.abs(deltaRawY) < dpToPxI(12))
							break;

						floatViewMoving = true;
					}

					SharedSettings.floatViewY = floatViewInitialY + deltaRawY;
					layoutParams.y = SharedSettings.floatViewY;
					windowManager.updateViewLayout(floatView, layoutParams);
					break;

				case MotionEvent.ACTION_UP:
					if (!floatViewMoving)
						view.performClick();

				case MotionEvent.ACTION_CANCEL:
					floatViewMoving = false;
					break;
				}

				return true;
			});
			floatView.addView(webView, new FrameLayout.LayoutParams(width, height));

			final int _24dp = dpToPxI(24);

			final ImageView imageView = new ImageView(application);
			imageView.setImageDrawable(application.getDrawable(R.drawable.ic_notification_gray));
			imageView.setContentDescription(application.getText(R.string.app_name));
			floatView.addView(imageView, new FrameLayout.LayoutParams(_24dp, _24dp, Gravity.START | Gravity.CENTER_VERTICAL));

			if (SharedSettings.floatViewY < 0)
				SharedSettings.floatViewY = _24dp << 1;

			layoutParams.alpha = 0.3f;
			layoutParams.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
			layoutParams.gravity = Gravity.START | Gravity.TOP;
			layoutParams.y = SharedSettings.floatViewY;
			layoutParams.width = _24dp;
			layoutParams.height = _24dp + (_24dp >> 1);
			layoutParams.format = PixelFormat.TRANSLUCENT;
			layoutParams.type = (WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY);
			windowManager.addView(floatView, layoutParams);

			return true;
		}

		return false;
	}

	public int onBackPressed() {
		if (webView == null)
			return BACK_KEY_DESTROY;

		if (webView.canGoBack()) {
			webView.goBack();
			return BACK_KEY_PREVENT;
		} else if (webViewJavaScriptInterface.paused || enterFloatModeIfPossible()) {
			return BACK_KEY_DESTROY;
		}

		return BACK_KEY_MOVE_TO_BACK;
	}

	public void onPause() {
		if (webView != null) {
			webView.onPause();
			// Calling this makes the playback stop after a few seconds
			//webView.pauseTimers();
		}
	}

	public void onResume() {
		if (webView != null) {
			webView.onResume();
			//webView.resumeTimers();
		}
	}

	public void onDestroy() {
		hostAlive = false;

		activity = null;

		final WebView webView = this.webView;

		if (webView != null) {
			this.webView = null;

			// We cannot pause webView before actually executing the function below
			webView.evaluateJavascript("App.mainWindowClosing()", value -> {
				// Try to make sure we have not returned in the meantime
				if (!hostAlive) {
					webView.onPause();
					webView.pauseTimers();
				}
			});
		}

		if (webViewJavaScriptInterface != null) {
			webViewJavaScriptInterface.destroy();
			webViewJavaScriptInterface = null;
		}
	}

	private void postCallbackPermissionResult(int permissionGranted) {
		pendingPermissionRequestResult = false;

		final WebView webView = this.webView;

		if (webView != null)
			webView.evaluateJavascript("FilePickerAndroidProvider.callbackPermission(" + permissionGranted + ")", null);
	}

	public void onRequestPermissionsResult(int[] grantResults) {
		postCallbackPermissionResult((grantResults == null || grantResults[0] != PackageManager.PERMISSION_GRANTED) ? 0 : 1);
	}
}

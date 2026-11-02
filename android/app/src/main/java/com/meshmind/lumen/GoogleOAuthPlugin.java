package com.meshmind.lumen;

import android.app.Dialog;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lumen Native In-App Google OAuth Plugin
 * 
 * Intercepts Google OAuth redirects (http://localhost, https://localhost, lumen://)
 * directly inside an In-App Secure Dialog so the user never encounters
 * external Chrome "localhost refused to connect (ERR_CONNECTION_REFUSED)" errors.
 */
@CapacitorPlugin(name = "GoogleOAuthNative")
public class GoogleOAuthPlugin extends Plugin {

    private static final String TAG = "GoogleOAuthNative";
    private Dialog authDialog;

    @PluginMethod
    public void signIn(PluginCall call) {
        String authUrl = call.getString("authUrl");
        if (authUrl == null || authUrl.isEmpty()) {
            call.reject("authUrl is required");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                if (authDialog != null && authDialog.isShowing()) {
                    authDialog.dismiss();
                }

                authDialog = new Dialog(getActivity(), android.R.style.Theme_DeviceDefault_Light_NoActionBar_Fullscreen);
                FrameLayout container = new FrameLayout(getActivity());
                container.setLayoutParams(new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                ));

                WebView webView = new WebView(getActivity());
                webView.setLayoutParams(new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                ));

                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setSupportZoom(true);
                settings.setBuiltInZoomControls(true);
                settings.setDisplayZoomControls(false);

                // Modern Mobile Chrome User-Agent ensures Google OAuth does not block with 403 disallowed_useragent
                settings.setUserAgentString("Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");

                CookieManager.getInstance().setAcceptCookie(true);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
                }

                ProgressBar progressBar = new ProgressBar(getActivity(), null, android.R.attr.progressBarStyleHorizontal);
                FrameLayout.LayoutParams pbParams = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    12
                );
                progressBar.setLayoutParams(pbParams);
                progressBar.setIndeterminate(true);

                container.addView(webView);
                container.addView(progressBar);

                webView.setWebViewClient(new WebViewClient() {
                    private boolean handled = false;

                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        return handleUrl(request.getUrl().toString());
                    }

                    @Override
                    @SuppressWarnings("deprecation")
                    public boolean shouldOverrideUrlLoading(WebView view, String url) {
                        return handleUrl(url);
                    }

                    @Override
                    public void onPageStarted(WebView view, String url, Bitmap favicon) {
                        super.onPageStarted(view, url, favicon);
                        progressBar.setVisibility(android.view.View.VISIBLE);
                        handleUrl(url);
                    }

                    @Override
                    public void onPageFinished(WebView view, String url) {
                        super.onPageFinished(view, url);
                        progressBar.setVisibility(android.view.View.GONE);
                        handleUrl(url);
                    }

                    private boolean handleUrl(String url) {
                        if (handled || url == null) return false;

                        // Check if redirect contains OAuth tokens or hits redirect URL
                        if (url.startsWith("http://localhost") ||
                            url.startsWith("https://localhost") ||
                            url.startsWith("lumen://") ||
                            url.contains("access_token=") ||
                            url.contains("id_token=")) {

                            if (url.contains("access_token=") || url.contains("id_token=")) {
                                handled = true;
                                Log.i(TAG, "Successfully intercepted Google OAuth tokens in redirect URL");
                                if (authDialog != null && authDialog.isShowing()) {
                                    authDialog.dismiss();
                                    authDialog = null;
                                }
                                JSObject ret = new JSObject();
                                ret.put("url", url);
                                ret.put("success", true);
                                call.resolve(ret);
                                return true;
                            }
                        }
                        return false;
                    }
                });

                authDialog.setContentView(container);
                authDialog.setOnCancelListener(dialogInterface -> {
                    call.reject("User cancelled Google Sign-In");
                });
                authDialog.show();
                webView.loadUrl(authUrl);

            } catch (Exception e) {
                Log.e(TAG, "Error opening Google Auth WebView: " + e.getMessage(), e);
                call.reject("Could not open Google sign-in: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void close(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (authDialog != null && authDialog.isShowing()) {
                authDialog.dismiss();
                authDialog = null;
            }
            call.resolve();
        });
    }
}

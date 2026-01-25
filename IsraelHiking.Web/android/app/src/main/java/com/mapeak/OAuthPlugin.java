package com.mapeak;

import android.content.Intent;
import android.net.Uri;

import androidx.browser.customtabs.CustomTabsIntent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OAuth")
public class OAuthPlugin extends Plugin {
    private static final String TAG = "OAuthPlugin";
    private PluginCall savedCall;

    @PluginMethod
    public void startOAuth(PluginCall call) {
        String authEndpoint = call.getString("authEndpoint");

        if (authEndpoint == null || authEndpoint.isEmpty()) {
            call.reject("Auth endpoint is required");
            return;
        }

        savedCall = call;

        // Launch OAuth in custom tab
        launchCustomTab(authEndpoint);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);

        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) {
            return;
        }

        Uri uri = intent.getData();
        if (uri == null) {
            return;
        }

        if (uri.getHost() == null || !uri.getHost().equals("oauth_callback")) {
            return;
        }

        try {
            JSObject result = new JSObject();
            result.put("oauth_callback_url", uri.toString());

            // Parse fragment parameters
            if (uri.getFragment() != null) {
                String fragment = uri.getFragment();
                String[] pairs = fragment.split("&");
                for (String pair : pairs) {
                    String[] keyValue = pair.split("=");
                    if (keyValue.length == 2) {
                        result.put(keyValue[0], keyValue[1]);
                    }
                }
            }

            // Parse query parameters
            for (String queryKey : uri.getQueryParameterNames()) {
                result.put(queryKey, uri.getQueryParameter(queryKey));
            }

            // Resolve the original call with the OAuth data
            if (savedCall != null) {
                savedCall.resolve(result);
                savedCall = null;
            }
        } catch (Exception e) {
            if (savedCall != null) {
                savedCall.reject("Failed to process OAuth callback", e);
                savedCall = null;
            }
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();

        // If we have a saved call and user returned without callback, reject
        if (savedCall != null) {
            savedCall.reject("OAuth cancelled or no callback received");
            savedCall = null;
        }
    }

    private void launchCustomTab(String url) {
        CustomTabsIntent.Builder builder = new CustomTabsIntent.Builder();

        CustomTabsIntent customTabsIntent = builder.build();
        customTabsIntent.intent.setFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);
        customTabsIntent.intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        customTabsIntent.intent.putExtra("android.support.customtabs.extra.ENABLE_URLBAR_HIDING", true);
        customTabsIntent.intent.putExtra("android.support.customtabs.extra.EXTRA_ENABLE_INSTANT_APPS", false);
        customTabsIntent.intent.putExtra("android.support.customtabs.extra.SEND_TO_EXTERNAL_HANDLER", false);
        customTabsIntent.intent.putExtra("androidx.browser.customtabs.extra.SHARE_STATE", 2);
        customTabsIntent.intent.putExtra("androidx.browser.customtabs.extra.DISABLE_BACKGROUND_INTERACTION", false);
        customTabsIntent.intent.putExtra("org.chromium.chrome.browser.customtabs.EXTRA_DISABLE_DOWNLOAD_BUTTON", true);
        customTabsIntent.intent.putExtra("org.chromium.chrome.browser.customtabs.EXTRA_DISABLE_STAR_BUTTON", true);

        customTabsIntent.launchUrl(getActivity(), Uri.parse(url));
    }
}

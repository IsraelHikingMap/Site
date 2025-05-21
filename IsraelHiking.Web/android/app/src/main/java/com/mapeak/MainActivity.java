package com.mapeak;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebView;

import androidx.annotation.Nullable;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {

                class FileChooserParamsWrapper extends FileChooserParams {
                    final FileChooserParams instance;
                    FileChooserParamsWrapper(FileChooserParams instance) {
                        this.instance = instance;
                    }

                    @Override
                    public int getMode() {
                        return this.instance.getMode();
                    }

                    @Override
                    public String[] getAcceptTypes() {
                        return this.instance.getAcceptTypes();
                    }

                    @Override
                    public boolean isCaptureEnabled() {
                        return this.instance.isCaptureEnabled();
                    }

                    @Nullable
                    @Override
                    public CharSequence getTitle() {
                        return this.instance.getTitle();
                    }

                    @Nullable
                    @Override
                    public String getFilenameHint() {
                        return this.instance.getFilenameHint();
                    }

                    @Override
                    public Intent createIntent() {
                        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                        intent.setType("*/*");
                        return intent;
                    }
                }

                return super.onShowFileChooser(webView, filePathCallback, new FileChooserParamsWrapper(fileChooserParams));
            }
        });
    }
}
